/**
 * views/profile.js
 * ---------------------------------------------------------------------------
 * "My profile": view + edit account details and change the password.
 * Only a safe subset of fields can be edited, and the role is never editable
 * here (firestore.rules also blocks it, so this is defence in depth).
 */

import { el, icon, sectionCard, field, textInput, select, detailList } from '../ui.js';
import { DEPARTMENTS, YEARS, SECTIONS, ROLE_LABELS, ROLES } from '../constants.js';
import { updateOwnProfile, changePassword } from '../auth.js';
import { formatDateTime, checkPassword, friendlyAuthError, initials, isValidRegisterNumber } from '../utils.js';

export function createProfile(ctx) {
  const profile = ctx.profile;
  const isStudent = profile.role === ROLES.STUDENT;

  /* ------------------------------------------------------- details panel */

  const details = detailList([
    { label: 'Full name', value: profile.fullName || '—' },
    { label: 'Email address', value: profile.email },
    { label: 'Role', value: ROLE_LABELS[profile.role] || profile.role },
    ...(isStudent
      ? [
          { label: 'Register number', value: profile.regNo || '—' },
          { label: 'Department', value: profile.department || '—' },
          { label: 'Year', value: profile.year || '—' },
          { label: 'Section', value: profile.section || '—' },
        ]
      : [{ label: 'Hostel scope', value: profile.hostelName || 'All hostels' }]),
    { label: 'Account status', value: profile.active === false ? 'Deactivated' : 'Active' },
    { label: 'Member since', value: formatDateTime(profile.createdAt) },
  ]);

  const summary = el('div', { class: 'row', style: { gap: '16px' } },
    el('div', { class: 'avatar', style: { width: '62px', height: '62px', flexBasis: '62px', fontSize: '20px' } }, initials(profile.fullName || profile.email)),
    el('div', {},
      el('div', { style: { fontSize: '18px', fontWeight: '700' } }, profile.fullName || 'Unnamed user'),
      el('div', { class: 'muted', text: profile.email }),
      el('div', { class: 'row', style: { marginTop: '6px' } }, el('span', { class: 'chip', text: ROLE_LABELS[profile.role] || profile.role }))
    )
  );

  /* ---------------------------------------------------------- edit form */

  const fullName = textInput({ id: 'pName', value: profile.fullName || '', required: true });
  const regNo = textInput({ id: 'pReg', value: profile.regNo || '' });
  const department = select({ id: 'pDept', options: DEPARTMENTS, value: profile.department || '', placeholder: 'Select department' });
  const year = select({ id: 'pYear', options: YEARS, value: profile.year || '', placeholder: 'Select year' });
  const section = select({ id: 'pSection', options: SECTIONS, value: profile.section || '', placeholder: 'Select section' });

  const editButton = el('button', { class: 'btn btn--primary', type: 'submit' }, icon('check', 15), 'Save changes');

  const editForm = el('form', { class: 'stack', novalidate: true },
    el('div', { class: 'grid-form' },
      field({ label: 'Full name', required: true, control: fullName, id: 'pName' })
    ),
    isStudent
      ? el('div', { class: 'grid-form grid-form--3' },
          field({ label: 'Register number', control: regNo, id: 'pReg' }),
          field({ label: 'Department', control: department, id: 'pDept' }),
          field({ label: 'Year', control: year, id: 'pYear' }),
          field({ label: 'Section', control: section, id: 'pSection' })
        )
      : el('p', { class: 'muted' }, 'Your role and hostel scope are managed by the Super Admin.'),
    editButton
  );

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!fullName.value.trim()) return ctx.toast('Please enter your full name.', 'error');
    if (isStudent && regNo.value.trim() && !isValidRegisterNumber(regNo.value.trim())) {
      return ctx.toast('Register number looks invalid.', 'error');
    }
    editButton.disabled = true;
    try {
      await updateOwnProfile(profile.uid, {
        fullName: fullName.value.trim(),
        ...(isStudent
          ? { regNo: regNo.value.trim(), department: department.value, year: year.value, section: section.value }
          : {}),
      });
      // Keep the in-memory profile fresh so the sidebar updates immediately.
      ctx.profile.fullName = fullName.value.trim();
      if (isStudent) {
        ctx.profile.regNo = regNo.value.trim();
        ctx.profile.department = department.value;
        ctx.profile.year = year.value;
        ctx.profile.section = section.value;
      }
      ctx.refreshChrome();
      ctx.toast('Profile updated.', 'success');
    } catch (error) {
      ctx.toast(friendlyAuthError(error), 'error');
    } finally {
      editButton.disabled = false;
    }
  });

  /* ------------------------------------------------------ password form */

  const current = textInput({ id: 'pwCurrent', type: 'password', autocomplete: 'current-password', required: true });
  const next = textInput({ id: 'pwNext', type: 'password', autocomplete: 'new-password', required: true });
  const confirm = textInput({ id: 'pwConfirm', type: 'password', autocomplete: 'new-password', required: true });
  const pwButton = el('button', { class: 'btn btn--primary', type: 'submit' }, icon('shield', 15), 'Update password');

  const passwordForm = el('form', { class: 'stack', novalidate: true },
    el('div', { class: 'grid-form' },
      field({ label: 'Current password', required: true, control: current, id: 'pwCurrent' }),
      field({ label: 'New password', required: true, control: next, id: 'pwNext', hint: 'At least 8 characters with a letter and a number.' })
    ),
    field({ label: 'Confirm new password', required: true, control: confirm, id: 'pwConfirm' }),
    pwButton
  );

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const strength = checkPassword(next.value);
    if (!strength.valid) return ctx.toast(`Password needs ${strength.problems.join(', ')}.`, 'error');
    if (next.value !== confirm.value) return ctx.toast('New passwords do not match.', 'error');
    pwButton.disabled = true;
    try {
      await changePassword(current.value, next.value);
      ctx.toast('Password updated successfully.', 'success');
      passwordForm.reset();
    } catch (error) {
      ctx.toast(friendlyAuthError(error), 'error');
    } finally {
      pwButton.disabled = false;
    }
  });

  return {
    element: el('div', { class: 'stack' },
      sectionCard({ title: 'Account overview', iconName: 'user', body: el('div', { class: 'stack' }, summary, el('div', { class: 'divider' }), details) }),
      sectionCard({ title: 'Edit profile', subtitle: 'Keep your contact and academic details up to date.', iconName: 'user', body: editForm }),
      sectionCard({ title: 'Change password', subtitle: 'You will stay signed in after changing it.', iconName: 'shield', body: passwordForm })
    ),
  };
}
