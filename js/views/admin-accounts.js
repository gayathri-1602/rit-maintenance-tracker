/**
 * views/admin-accounts.js
 * ---------------------------------------------------------------------------
 * Super Admin screen for people management:
 *   - create College / Hostel / Super admin accounts securely
 *   - change an account's role and hostel assignment
 *   - activate / deactivate any account
 *   - browse every registered student
 *
 * Route: #/admins and #/students
 */

import { el, icon, sectionCard, dataTable, field, textInput, select, openModal, confirmDialog, statCard } from '../ui.js';
import { HOSTELS, ROLES, ROLE_LABELS } from '../constants.js';
import { subscribeAllUsers, createAdminAccount, updateUserRole, setUserActive } from '../auth.js';
import { checkPassword, isValidEmail, friendlyAuthError, formatDateTime, initials } from '../utils.js';

export function createAdminAccounts(ctx, { initialTab = 'admins' } = {}) {
  let users = [];
  let unsub = null;
  let activeTab = initialTab;

  const adminsTable = dataTable({
    columns: [
      { key: 'fullName', label: 'Admin', sortable: true,
        render: (u) => el('div', { class: 'row' },
          el('div', { class: 'avatar avatar--sm' }, initials(u.fullName || u.email)),
          el('div', {},
            el('div', { style: { fontWeight: '600' }, text: u.fullName || 'Unnamed' }),
            el('div', { class: 'faint', text: u.email })
          )
        ) },
      { key: 'role', label: 'Role', sortable: true, render: (u) => el('span', { class: 'chip', text: ROLE_LABELS[u.role] || u.role }) },
      { key: 'hostelName', label: 'Hostel scope', sortable: true, render: (u) => u.role === ROLES.HOSTEL_ADMIN ? (u.hostelName || 'Not assigned') : '—' },
      { key: 'active', label: 'Status', sortable: true, render: (u) => el('span', { class: `chip ${u.active === false ? 'chip--rejected' : 'chip--resolved'}`, text: u.active === false ? 'Deactivated' : 'Active' }) },
      { key: 'createdAt', label: 'Created', sortable: true, sortValue: (u) => u.createdAt?.toMillis?.() || 0, render: (u) => formatDateTime(u.createdAt) },
      { key: 'actions', label: 'Actions', sortable: false, render: (u) => adminActions(u) },
    ],
    rows: [],
    emptyMessage: 'No admin accounts yet. Use “Create admin account” to add the first one.',
    pageSize: 10,
  });

  const studentsTable = dataTable({
    columns: [
      { key: 'fullName', label: 'Student', sortable: true,
        render: (u) => el('div', { class: 'row' },
          el('div', { class: 'avatar avatar--sm' }, initials(u.fullName || u.email)),
          el('div', {},
            el('div', { style: { fontWeight: '600' }, text: u.fullName || 'Unnamed' }),
            el('div', { class: 'faint', text: u.email })
          )
        ) },
      { key: 'regNo', label: 'Register no.', sortable: true },
      { key: 'department', label: 'Department', sortable: true },
      { key: 'year', label: 'Year', sortable: true },
      { key: 'section', label: 'Section', sortable: true },
      { key: 'active', label: 'Status', sortable: true, render: (u) => el('span', { class: `chip ${u.active === false ? 'chip--rejected' : 'chip--resolved'}`, text: u.active === false ? 'Deactivated' : 'Active' }) },
      { key: 'actions', label: 'Actions', sortable: false, render: (u) => studentActions(u) },
    ],
    rows: [],
    emptyMessage: 'No students have registered yet.',
    pageSize: 12,
  });

  /* --------------------------------------------------------- row actions */

  function adminActions(user) {
    const wrap = el('div', { class: 'table__actions' });
    wrap.appendChild(el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => openRoleModal(user) }, icon('shield', 14), 'Edit role'));
    if (user.uid !== ctx.profile.uid) {
      wrap.appendChild(el('button', {
        class: `btn btn--sm ${user.active === false ? 'btn--success' : 'btn--danger'}`,
        type: 'button',
        onclick: () => toggleActive(user),
      }, user.active === false ? 'Activate' : 'Deactivate'));
    }
    return wrap;
  }

  function studentActions(user) {
    return el('div', { class: 'table__actions' },
      el('button', {
        class: `btn btn--sm ${user.active === false ? 'btn--success' : 'btn--danger'}`,
        type: 'button',
        onclick: () => toggleActive(user),
      }, user.active === false ? 'Activate' : 'Deactivate')
    );
  }

  async function toggleActive(user) {
    const deactivating = user.active !== false;
    const ok = await confirmDialog({
      title: deactivating ? 'Deactivate this account?' : 'Activate this account?',
      message: deactivating
        ? `${user.fullName || user.email} will not be able to sign in until reactivated.`
        : `${user.fullName || user.email} will be able to sign in again.`,
      confirmLabel: deactivating ? 'Deactivate' : 'Activate',
      danger: deactivating,
    });
    if (!ok) return;
    try {
      await setUserActive(user.uid, !deactivating);
      ctx.toast(`Account ${deactivating ? 'deactivated' : 'activated'}.`, 'success');
    } catch (error) {
      ctx.toast(friendlyAuthError(error), 'error');
    }
  }

  function openRoleModal(user) {
    const role = select({ id: 'roleSelect', options: [
      { value: ROLES.COLLEGE_ADMIN, label: 'College Admin' },
      { value: ROLES.HOSTEL_ADMIN, label: 'Hostel Admin' },
      { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
    ], value: user.role });
    const hostel = select({ id: 'hostelSelect', options: HOSTELS, value: user.hostelName || '', placeholder: 'Select hostel' });
    const hostelField = field({ label: 'Assigned hostel', control: hostel, id: 'hostelSelect', hint: 'A hostel admin only sees complaints from this hostel.' });
    hostelField.hidden = role.value !== ROLES.HOSTEL_ADMIN;
    role.addEventListener('change', () => { hostelField.hidden = role.value !== ROLES.HOSTEL_ADMIN; });

    let modal;
    modal = openModal({
      title: `Edit access — ${user.fullName || user.email}`,
      size: 'sm',
      body: el('div', { class: 'stack' },
        field({ label: 'Role', control: role, id: 'roleSelect' }),
        hostelField
      ),
      footer: el('div', { class: 'row' },
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => modal.close() }, 'Cancel'),
        el('button', {
          class: 'btn btn--primary', type: 'button',
          onclick: async (event) => {
            if (role.value === ROLES.HOSTEL_ADMIN && !hostel.value) return ctx.toast('Please pick a hostel for this hostel admin.', 'error');
            event.currentTarget.disabled = true;
            try {
              await updateUserRole(user.uid, { role: role.value, hostelName: hostel.value });
              ctx.toast('Role updated.', 'success');
              modal.close();
            } catch (error) {
              ctx.toast(friendlyAuthError(error), 'error');
            }
          },
        }, 'Save')
      ),
    });
  }

  /* ------------------------------------------------------ create account */

  function openCreateModal() {
    const fullName = textInput({ id: 'newName', placeholder: 'e.g. Priya Raman', required: true });
    const email = textInput({ id: 'newEmail', type: 'email', placeholder: 'admin@rit.edu.in', required: true });
    const password = textInput({ id: 'newPassword', type: 'password', placeholder: 'Temporary password', autocomplete: 'new-password', required: true });
    const role = select({ id: 'newRole', options: [
      { value: ROLES.COLLEGE_ADMIN, label: 'College Admin' },
      { value: ROLES.HOSTEL_ADMIN, label: 'Hostel Admin' },
      { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
    ], value: ROLES.COLLEGE_ADMIN });
    const hostel = select({ id: 'newHostel', options: HOSTELS, placeholder: 'Select hostel' });
    const hostelField = field({ label: 'Assigned hostel', required: true, control: hostel, id: 'newHostel' });
    hostelField.hidden = true;
    role.addEventListener('change', () => { hostelField.hidden = role.value !== ROLES.HOSTEL_ADMIN; });

    let modal;
    modal = openModal({
      title: 'Create admin account',
      size: 'md',
      body: el('div', { class: 'stack' },
        el('div', { class: 'notice notice--info' }, icon('shield', 18),
          el('span', { text: 'Admin accounts are created with the role you choose here. The role is verified server-side, so it cannot be forged from the browser.' })),
        el('div', { class: 'grid-form' },
          field({ label: 'Full name', required: true, control: fullName, id: 'newName' }),
          field({ label: 'Email address', required: true, control: email, id: 'newEmail' })
        ),
        el('div', { class: 'grid-form' },
          field({ label: 'Temporary password', required: true, control: password, id: 'newPassword', hint: 'At least 8 characters with a letter and a number. Share it securely.' }),
          field({ label: 'Role', required: true, control: role, id: 'newRole' })
        ),
        hostelField
      ),
      footer: el('div', { class: 'row' },
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => modal.close() }, 'Cancel'),
        el('button', {
          class: 'btn btn--primary', type: 'button',
          onclick: async (event) => {
            const values = {
              fullName: fullName.value.trim(),
              email: email.value.trim(),
              password: password.value,
              role: role.value,
              hostelName: role.value === ROLES.HOSTEL_ADMIN ? hostel.value : null,
            };
            if (!values.fullName || !values.email || !values.password) return ctx.toast('Please fill in every field.', 'error');
            if (!isValidEmail(values.email)) return ctx.toast('Please enter a valid email address.', 'error');
            const strength = checkPassword(values.password);
            if (!strength.valid) return ctx.toast(`Password needs ${strength.problems.join(', ')}.`, 'error');
            if (values.role === ROLES.HOSTEL_ADMIN && !values.hostelName) return ctx.toast('Please pick a hostel.', 'error');

            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = 'Creating…';
            try {
              await createAdminAccount(values);
              ctx.toast(`Admin account created for ${values.email}.`, 'success');
              modal.close();
            } catch (error) {
              ctx.toast(friendlyAuthError(error), 'error');
            } finally {
              button.disabled = false;
              button.textContent = 'Create account';
            }
          },
        }, 'Create account')
      ),
    });
  }

  /* ------------------------------------------------------------- layout */

  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search by name, email or register number…' });
  search.addEventListener('input', () => applySearch());

  const stats = el('div', { class: 'grid-stats' });

  function applySearch() {
    const term = search.value.trim().toLowerCase();
    const admins = users.filter((u) => u.role && u.role !== ROLES.STUDENT);
    const students = users.filter((u) => u.role === ROLES.STUDENT);
    const match = (u) => !term || [u.fullName, u.email, u.regNo].filter(Boolean).join(' ').toLowerCase().includes(term);
    adminsTable.setRows(admins.filter(match));
    studentsTable.setRows(students.filter(match));
  }

  const tabs = el('div', { class: 'auth__tabs', style: { maxWidth: '320px' } },
    el('button', { class: `auth__tab ${activeTab === 'admins' ? 'is-active' : ''}`, type: 'button', onclick: () => setTab('admins') }, 'Admin accounts'),
    el('button', { class: `auth__tab ${activeTab === 'students' ? 'is-active' : ''}`, type: 'button', onclick: () => setTab('students') }, 'Students')
  );

  const adminsPanel = sectionCard({
    title: 'Admin accounts',
    subtitle: 'College, hostel and super administrators',
    iconName: 'shield',
    actions: el('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: openCreateModal }, icon('plus', 15), 'Create admin account'),
    body: adminsTable.element,
  });

  const studentsPanel = sectionCard({
    title: 'Registered students',
    subtitle: 'Every student account in the system',
    iconName: 'users',
    body: studentsTable.element,
  });

  const panelsHost = el('div', {});

  function setTab(tab) {
    activeTab = tab;
    tabs.querySelectorAll('.auth__tab').forEach((button, index) => {
      button.classList.toggle('is-active', (index === 0 ? 'admins' : 'students') === tab);
    });
    panelsHost.replaceChildren(tab === 'admins' ? adminsPanel : studentsPanel);
  }

  function render() {
    const admins = users.filter((u) => u.role && u.role !== ROLES.STUDENT);
    const students = users.filter((u) => u.role === ROLES.STUDENT);
    stats.replaceChildren(
      statCard({ label: 'Total users', value: users.length, tone: 'blue', iconName: 'users' }),
      statCard({ label: 'Students', value: students.length, tone: 'blue', iconName: 'user' }),
      statCard({ label: 'Admins', value: admins.length, tone: 'violet', iconName: 'shield' }),
      statCard({ label: 'Deactivated', value: users.filter((u) => u.active === false).length, tone: 'red', iconName: 'alert' })
    );
    applySearch();
  }

  unsub = subscribeAllUsers(
    (rows) => {
      users = rows;
      render();
    },
    (error) => ctx.toast(friendlyAuthError(error), 'error')
  );

  setTab(activeTab);

  return {
    element: el('div', { class: 'stack' },
      stats,
      el('div', { class: 'row row--between' }, tabs, el('div', { class: 'search', style: { maxWidth: '340px' } }, icon('search', 17), search)),
      panelsHost
    ),
    destroy() {
      if (unsub) unsub();
    },
  };
}
