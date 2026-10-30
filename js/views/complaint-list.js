/**
 * views/complaint-list.js
 * ---------------------------------------------------------------------------
 * ONE list component used by every role. What changes per role is only:
 *   - which filters are useful (hostel / type filters are Super Admin extras)
 *   - which row actions appear (students get "Feedback", admins get "Update")
 *
 * This avoids three near-identical tables drifting apart over time.
 */

import { el, icon, dataTable, select, statusChip, priorityChip, emptyState, sectionCard } from '../ui.js';
import { STATUSES, PRIORITIES, HOSTELS, COMPLAINT_TYPE, ROLES } from '../constants.js';
import { liveComplaints, locationText, attachmentCell } from './shared.js';
import { openUpdateModal, openFeedbackModal, markResolved } from './complaint-actions.js';
import { subscribeCategories } from '../categories.js';
import { formatDateTime, friendlyAuthError, downloadCsv } from '../utils.js';
import { navigate } from '../router.js';

export function createComplaintList(ctx, options = {}) {
  const {
    mode = 'student',
    title = 'Complaints',
    subtitle = '',
    showHostelFilter = false,
    showTypeFilter = false,
    showExport = false,
  } = options;
  const isAdmin = mode === 'admin' || mode === 'super';

  let all = [];
  let categories = { College: [], Hostel: [] };
  let unsubComplaints = null;
  let unsubCategories = null;

  /* ------------------------------------------------------------ filters */

  const search = el('input', { class: 'input', type: 'search', placeholder: isAdmin ? 'Search by student name or complaint ID…' : 'Search by complaint ID or category…' });
  const statusFilter = select({ options: ['All statuses', ...STATUSES], value: 'All statuses' });
  const priorityFilter = select({ options: ['All priorities', ...PRIORITIES], value: 'All priorities' });
  const categoryFilter = select({ options: ['All categories'], value: 'All categories' });
  const hostelFilter = showHostelFilter ? select({ options: ['All hostels', ...HOSTELS], value: 'All hostels' }) : null;
  const typeFilter = showTypeFilter ? select({ options: ['All types', COMPLAINT_TYPE.COLLEGE, COMPLAINT_TYPE.HOSTEL], value: 'All types' }) : null;

  const activeOnly = el('input', { type: 'checkbox', id: 'activeOnly' });
  const activeOnlyLabel = el('label', { class: 'row', for: 'activeOnly', style: { gap: '6px', fontSize: '13px', cursor: 'pointer' } },
    activeOnly, el('span', { text: 'Open only' }));

  const clearButton = el('button', {
    class: 'btn btn--ghost btn--sm',
    type: 'button',
    onclick: () => {
      search.value = '';
      statusFilter.value = 'All statuses';
      priorityFilter.value = 'All priorities';
      categoryFilter.value = 'All categories';
      if (hostelFilter) hostelFilter.value = 'All hostels';
      if (typeFilter) typeFilter.value = 'All types';
      activeOnly.checked = false;
      applyFilters();
    },
  }, icon('refresh', 15), 'Reset');

  const exportButton = showExport
    ? el('button', {
        class: 'btn btn--ghost btn--sm',
        type: 'button',
        onclick: () => exportCsv(),
      }, icon('download', 15), 'Export CSV')
    : null;

  [search, statusFilter, priorityFilter, categoryFilter, hostelFilter, typeFilter].forEach((control) => {
    if (control) control.addEventListener('input', applyFilters);
    if (control) control.addEventListener('change', applyFilters);
  });
  activeOnly.addEventListener('change', applyFilters);

  const toolbar = el('div', { class: 'toolbar' },
    el('div', { class: 'search' }, icon('search', 17), search),
    statusFilter,
    priorityFilter,
    categoryFilter,
    hostelFilter,
    typeFilter,
    activeOnlyLabel,
    el('div', { class: 'toolbar__spacer' }),
    exportButton,
    clearButton
  );

  /* -------------------------------------------------------------- table */

  const columns = buildColumns();
  const table = dataTable({ columns, rows: [], emptyMessage: 'No complaints match your filters.', pageSize: 12 });

  function buildColumns() {
    const cols = [
      { key: 'complaintCode', label: 'Complaint ID', sortable: true, sortValue: (r) => r.complaintCode || r.id,
        render: (r) => el('span', { class: 'chip chip--submitted', text: r.complaintCode || r.id }) },
      { key: 'studentName', label: 'Student', sortable: true,
        render: (r) => el('div', {},
          el('div', { style: { fontWeight: '600' }, text: r.studentName || '—' }),
          el('div', { class: 'faint', text: r.registerNumber || r.studentEmail || '' })
        ) },
      { key: 'location', label: 'Location', sortable: true, sortValue: (r) => locationText(r), render: (r) => locationText(r) },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'priority', label: 'Priority', sortable: true, render: (r) => priorityChip(r.priority) },
      { key: 'status', label: 'Status', sortable: true, render: (r) => statusChip(r.status) },
      { key: 'updatedAt', label: 'Last updated', sortable: true, sortValue: (r) => r.updatedAt?.toMillis?.() || 0, render: (r) => formatDateTime(r.updatedAt) },
      { key: 'attachment', label: 'File', sortable: false, render: (r) => attachmentCell(r) },
      { key: 'actions', label: 'Actions', sortable: false, render: (r) => actionCell(r) },
    ];
    if (!isAdmin) {
      // Students don't need the "Student" column - every row is theirs.
      return cols.filter((c) => c.key !== 'studentName');
    }
    return cols;
  }

  function actionCell(complaint) {
    const wrap = el('div', { class: 'table__actions' });
    wrap.appendChild(el('button', {
      class: 'btn btn--ghost btn--sm',
      type: 'button',
      onclick: (e) => { e.stopPropagation(); navigate(`/complaints/${complaint.id}`); },
    }, icon('eye', 14), 'View'));

    if (isAdmin) {
      wrap.appendChild(el('button', {
        class: 'btn btn--primary btn--sm',
        type: 'button',
        onclick: (e) => { e.stopPropagation(); openUpdateModal(ctx, complaint, () => {}); },
      }, 'Update'));
      if (complaint.status !== 'Resolved' && complaint.status !== 'Rejected') {
        wrap.appendChild(el('button', {
          class: 'btn btn--success btn--sm',
          type: 'button',
          onclick: (e) => { e.stopPropagation(); markResolved(ctx, complaint, () => {}); },
        }, 'Resolve'));
      }
    } else if (complaint.status === 'Resolved' && !complaint.feedback) {
      wrap.appendChild(el('button', {
        class: 'btn btn--primary btn--sm',
        type: 'button',
        onclick: (e) => { e.stopPropagation(); openFeedbackModal(ctx, complaint, () => {}); },
      }, icon('star', 14), 'Feedback'));
    }
    return wrap;
  }

  /* ------------------------------------------------------------ filters */

  function applyFilters() {
    const term = search.value.trim().toLowerCase();
    const status = statusFilter.value;
    const priority = priorityFilter.value;
    const category = categoryFilter.value;
    const hostel = hostelFilter?.value;
    const type = typeFilter?.value;

    const filtered = all.filter((c) => {
      if (status !== 'All statuses' && c.status !== status) return false;
      if (priority !== 'All priorities' && c.priority !== priority) return false;
      if (category !== 'All categories' && c.category !== category) return false;
      if (hostel && hostel !== 'All hostels' && c.hostelName !== hostel) return false;
      if (type && type !== 'All types' && c.complaintType !== type) return false;
      if (activeOnly.checked && ['Resolved', 'Rejected'].includes(c.status)) return false;
      if (term) {
        const haystack = [c.complaintCode, c.id, c.studentName, c.registerNumber, c.category, c.description, c.studentEmail]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    table.setRows(filtered);
    countLabel.textContent = `${filtered.length} of ${all.length} complaint${all.length === 1 ? '' : 's'}`;
  }

  const countLabel = el('span', { class: 'muted' });

  /* -------------------------------------------------------- data wiring */

  function refresh() {
    unsubComplaints = liveComplaints(
      ctx,
      (rows) => {
        all = rows;
        applyFilters();
        if (typeof options.onData === 'function') options.onData(rows);
      },
      (error) => {
        ctx.toast(friendlyAuthError(error), 'error');
        table.setRows([]);
      }
    );
  }

  unsubCategories = subscribeCategories(
    (merged) => {
      categories = merged;
      const names = [...new Set([...merged.College, ...merged.Hostel])].sort();
      const current = categoryFilter.value;
      categoryFilter.replaceChildren(
        el('option', { value: 'All categories' }, 'All categories'),
        ...names.map((name) => el('option', { value: name }, name))
      );
      categoryFilter.value = names.includes(current) ? current : 'All categories';
    },
    () => {}
  );

  refresh();

  const body = el('div', {},
    toolbar,
    el('div', { class: 'row row--between', style: { marginBottom: '8px' } },
      countLabel,
      el('span', { class: 'faint', text: 'Click a column header to sort' })
    ),
    table.element
  );

  const panel = sectionCard({ title, subtitle, iconName: 'list', body, className: 'panel--flush-body' });

  return {
    element: panel,
    destroy() {
      if (unsubComplaints) unsubComplaints();
      if (unsubCategories) unsubCategories();
    },
  };

  /* -------------------------------------------------------------- export */

  function exportCsv() {
    if (!all.length) return ctx.toast('There is nothing to export yet.', 'warning');
    const headers = [
      'Complaint ID', 'Type', 'Student', 'Register No', 'Department', 'Year', 'Section',
      'Hostel', 'Room', 'Floor', 'Category', 'Priority', 'Status', 'Description',
      'Admin remarks', 'Attachment', 'Created', 'Updated', 'Rating',
    ];
    const rows = all.map((c) => [
      c.complaintCode || c.id, c.complaintType, c.studentName, c.registerNumber, c.department, c.year, c.section,
      c.hostelName || '', c.roomNumber || '', c.floor || '', c.category, c.priority, c.status,
      c.description, c.adminRemarks || '', c.attachment?.url || '',
      formatDateTime(c.createdAt), formatDateTime(c.updatedAt), c.feedback?.rating || '',
    ]);
    downloadCsv(`rit-complaints-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    ctx.toast('Complaint report exported.', 'success');
  }
}
