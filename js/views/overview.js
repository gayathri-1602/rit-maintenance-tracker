/**
 * views/overview.js
 * ---------------------------------------------------------------------------
 * The dashboard landing page for every role. The layout is identical; only the
 * stat cards and the extra panels change, based on `ctx.profile.role`.
 */

import { el, icon, statCard, sectionCard, dataTable, statusChip, priorityChip, emptyState, noticeBox } from '../ui.js';
import { ROLES } from '../constants.js';
import { liveComplaints, locationText, starRating, attachmentCell } from './shared.js';
import { summarise, averageRating } from '../complaints.js';
import { formatDateTime, friendlyAuthError, countBy } from '../utils.js';
import { navigate } from '../router.js';
import { openUpdateModal, markResolved, openFeedbackModal } from './complaint-actions.js';

export function createOverview(ctx) {
  const role = ctx.profile.role;
  const isAdmin = role !== ROLES.STUDENT;

  const statsHost = el('div', { class: 'grid-stats' });
  const recentHost = el('div', {});
  const extraHost = el('div', { class: 'grid-2' });
  let unsub = null;

  function cardsFor(summary) {
    if (!isAdmin) {
      return [
        statCard({ label: 'Total complaints', value: summary.total, tone: 'blue', iconName: 'list' }),
        statCard({ label: 'Awaiting action', value: summary.submitted + summary.pending, tone: 'amber', iconName: 'clock' }),
        statCard({ label: 'In progress', value: summary.inProgress, tone: 'violet', iconName: 'refresh' }),
        statCard({ label: 'Resolved', value: summary.resolved, tone: 'green', iconName: 'check' }),
      ];
    }
    const cards = [
      statCard({ label: 'Total complaints', value: summary.total, tone: 'blue', iconName: 'list' }),
      statCard({ label: 'Awaiting action', value: summary.submitted + summary.pending, tone: 'amber', iconName: 'clock' }),
      statCard({ label: 'In progress', value: summary.inProgress, tone: 'violet', iconName: 'refresh' }),
      statCard({ label: 'Resolved', value: summary.resolved, tone: 'green', iconName: 'check' }),
      statCard({ label: 'High priority open', value: summary.highOpen, tone: 'red', iconName: 'alert' }),
    ];
    if (role === ROLES.COLLEGE_ADMIN || role === ROLES.HOSTEL_ADMIN || role === ROLES.SUPER_ADMIN) {
      const avg = averageRating(summary);
      cards.push(statCard({ label: 'Average rating', value: avg ? avg.toFixed(1) : '—', tone: 'blue', iconName: 'star', hint: `${summary.ratingCount} rating(s)` }));
    }
    return cards;
  }

  function render(complaints) {
    const summary = summarise(complaints);
    statsHost.replaceChildren(...cardsFor(summary));

    /* ------------------------------------------------- recent complaints */
    const recent = [...complaints]
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 6);

    const recentTable = dataTable({
      columns: [
        { key: 'complaintCode', label: 'ID', sortable: false,
          render: (r) => el('span', { class: 'chip chip--submitted', text: r.complaintCode || r.id }) },
        { key: 'category', label: 'Category', sortable: false },
        { key: 'location', label: 'Location', sortable: false, render: (r) => locationText(r) },
        { key: 'priority', label: 'Priority', sortable: false, render: (r) => priorityChip(r.priority) },
        { key: 'status', label: 'Status', sortable: false, render: (r) => statusChip(r.status) },
        { key: 'createdAt', label: 'Submitted', sortable: false, render: (r) => formatDateTime(r.createdAt) },
        { key: 'actions', label: '', sortable: false, render: (r) => el('button', {
            class: 'btn btn--ghost btn--sm', type: 'button',
            onclick: (e) => { e.stopPropagation(); navigate(`/complaints/${r.id}`); },
          }, 'View') },
      ],
      rows: recent,
      emptyMessage: isAdmin ? 'No complaints have been submitted yet.' : 'You have not submitted any complaints yet.',
    });

    const quickActions = isAdmin
      ? el('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => navigate('/complaints') },
          icon('list', 15), 'Open complaint queue')
      : el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => navigate('/new') },
            icon('plus', 15), 'Submit a complaint'),
          el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => navigate('/complaints') },
            icon('list', 15), 'Track my complaints')
        );

    recentHost.replaceChildren(
      sectionCard({
        title: 'Recent complaints',
        subtitle: isAdmin ? 'Latest submissions in your queue' : 'Your latest submissions and their live status',
        iconName: 'clock',
        actions: quickActions,
        body: recentTable.element,
      })
    );

    /* --------------------------------------------------------- extra row */
    const extras = [];

    if (isAdmin) {
      extras.push(sectionCard({
        title: 'By category',
        iconName: 'tag',
        body: categoryBreakdown(complaints),
      }));
    }

    if (isAdmin) {
      const awaiting = complaints.filter((c) => c.status === 'Resolved' && !c.feedback);
      extras.push(sectionCard({
        title: 'Awaiting student feedback',
        subtitle: `${awaiting.length} resolved complaint(s) without a rating`,
        iconName: 'star',
        body: awaiting.length
          ? el('div', { class: 'stack' }, ...awaiting.slice(0, 5).map((c) => complaintRow(c)))
          : emptyState({ title: 'All caught up', message: 'Every resolved complaint has received feedback.', iconName: 'check' }),
      }));
    }

    if (!isAdmin) {
      const resolvedWithoutFeedback = complaints.filter((c) => c.status === 'Resolved' && !c.feedback);
      extras.push(sectionCard({
        title: 'Needs your feedback',
        subtitle: 'Resolved complaints waiting for your rating',
        iconName: 'star',
        body: resolvedWithoutFeedback.length
          ? el('div', { class: 'stack' }, ...resolvedWithoutFeedback.slice(0, 5).map((c) => complaintRow(c, { feedback: true })))
          : emptyState({ title: 'Nothing pending', message: 'Thanks for keeping the campus running smoothly!', iconName: 'check' }),
      }));
    }

    extraHost.replaceChildren(...extras);
    extraHost.classList.toggle('hidden', extras.length === 0);
  }

  function categoryBreakdown(complaints) {
    const counts = countBy(complaints, 'category');
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return emptyState({ title: 'No data yet', iconName: 'chart' });
    const max = entries[0][1] || 1;
    return el('div', { class: 'stack', style: { gap: '10px' } },
      ...entries.map(([name, count]) => el('div', { class: 'stack', style: { gap: '4px' } },
        el('div', { class: 'row row--between' }, el('span', { text: name }), el('strong', { text: String(count) })),
        el('div', { class: 'upload-track' }, el('div', { class: 'upload-track__bar', style: { width: `${(count / max) * 100}%` } }))
      ))
    );
  }

  function complaintRow(complaint, opts = {}) {
    return el('div', { class: 'row row--between', style: { gap: '10px', padding: '8px 0', borderBottom: '1px dashed var(--border)' } },
      el('div', { class: 'grow' },
        el('div', { style: { fontWeight: '600' }, text: `${complaint.complaintCode || complaint.id} • ${complaint.category}` }),
        el('div', { class: 'faint', text: locationText(complaint) })
      ),
      opts.feedback
        ? el('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => openFeedbackModal(ctx, complaint, () => {}) }, 'Rate')
        : el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => navigate(`/complaints/${complaint.id}`) }, 'View')
    );
  }

  unsub = liveComplaints(
    ctx,
    (complaints) => render(complaints),
    (error) => {
      statsHost.replaceChildren();
      recentHost.replaceChildren(noticeBox(`Could not load your dashboard data: ${friendlyAuthError(error)}`, 'danger'));
    }
  );

  statsHost.replaceChildren(...Array.from({ length: 4 }, () => statCard({ label: 'Loading…', value: '—', tone: 'blue' })));

  return {
    element: el('div', { class: 'stack' }, statsHost, recentHost, extraHost),
    destroy() {
      if (unsub) unsub();
    },
  };
}
