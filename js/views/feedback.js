/**
 * views/feedback.js
 * ---------------------------------------------------------------------------
 * Admin view of every rating and comment students left after a complaint was
 * resolved, plus a small satisfaction summary.
 *
 * Route: #/feedback
 */

import { el, icon, sectionCard, dataTable, statCard, emptyState } from '../ui.js';
import { liveComplaints, starRating, locationText } from './shared.js';
import { averageRating, summarise } from '../complaints.js';
import { formatDateTime, friendlyAuthError } from '../utils.js';
import { navigate } from '../router.js';

export function createFeedbackView(ctx) {
  let unsub = null;
  const stats = el('div', { class: 'grid-stats' });
  const tableHost = el('div', {});

  const table = dataTable({
    columns: [
      { key: 'complaintCode', label: 'Complaint ID', sortable: true, sortValue: (r) => r.complaintCode || r.id,
        render: (r) => el('span', { class: 'chip chip--submitted', text: r.complaintCode || r.id }) },
      { key: 'studentName', label: 'Student', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'location', label: 'Location', sortable: true, sortValue: (r) => locationText(r), render: (r) => locationText(r) },
      { key: 'rating', label: 'Rating', sortable: true, sortValue: (r) => r.feedback?.rating || 0, render: (r) => starRating(r.feedback?.rating || 0) },
      { key: 'comment', label: 'Comment', sortable: false, render: (r) => r.feedback?.comment || el('span', { class: 'faint', text: 'No comment' }) },
      { key: 'feedbackAt', label: 'Submitted', sortable: true, sortValue: (r) => r.feedback?.createdAt?.toMillis?.() || 0, render: (r) => formatDateTime(r.feedback?.createdAt) },
      { key: 'actions', label: '', sortable: false, render: (r) => el('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onclick: () => navigate(`/complaints/${r.id}`),
        }, 'View') },
    ],
    rows: [],
    emptyMessage: 'No feedback yet. Feedback appears here after students rate resolved complaints.',
    pageSize: 12,
  });

  function render(complaints) {
    const withFeedback = complaints.filter((c) => c.feedback?.rating);
    const summary = summarise(complaints);
    const avg = averageRating(summary);

    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: withFeedback.filter((c) => c.feedback.rating === star).length,
    }));

    stats.replaceChildren(
      statCard({ label: 'Feedback received', value: withFeedback.length, tone: 'blue', iconName: 'star' }),
      statCard({ label: 'Average rating', value: avg ? avg.toFixed(1) : '—', tone: 'green', iconName: 'chart' }),
      statCard({ label: 'Resolved complaints', value: summary.resolved, tone: 'violet', iconName: 'check' }),
      statCard({ label: 'Still awaiting feedback', value: summary.awaitingFeedback, tone: 'amber', iconName: 'clock' })
    );

    const max = Math.max(1, ...distribution.map((d) => d.count));
    const breakdown = el('div', { class: 'stack', style: { gap: '10px' } },
      ...distribution.map((d) => el('div', { class: 'stack', style: { gap: '4px' } },
        el('div', { class: 'row row--between' }, el('span', { text: `${d.star} star${d.star > 1 ? 's' : ''}` }), el('strong', { text: String(d.count) })),
        el('div', { class: 'upload-track' }, el('div', { class: 'upload-track__bar', style: { width: `${(d.count / max) * 100}%` } }))
      ))
    );

    tableHost.replaceChildren(
      el('div', { class: 'grid-2' },
        sectionCard({
          title: 'Satisfaction summary',
          iconName: 'chart',
          body: withFeedback.length
            ? el('div', { class: 'stack' },
                el('div', { class: 'rating-summary' },
                  el('div', { class: 'rating-summary__score', text: avg.toFixed(1) }),
                  el('div', {}, starRating(Math.round(avg)), el('div', { class: 'faint', text: `${withFeedback.length} rating(s)` }))
                ),
                el('div', { class: 'divider' }),
                breakdown
              )
            : emptyState({ title: 'No ratings yet', message: 'Once students rate resolved complaints you will see the breakdown here.', iconName: 'star' })
        }),
        sectionCard({
          title: 'All feedback',
          subtitle: 'Sort by rating or date to spot recurring issues',
          iconName: 'star',
          body: table.element
        })
      )
    );

    table.setRows([...withFeedback].sort((a, b) => (b.feedback?.createdAt?.toMillis?.() || 0) - (a.feedback?.createdAt?.toMillis?.() || 0)));
  }

  unsub = liveComplaints(ctx, render, (error) => {
    tableHost.replaceChildren(el('div', { class: 'notice notice--danger' }, icon('alert', 18), el('span', { text: friendlyAuthError(error) })));
  });

  return {
    element: el('div', { class: 'stack' }, stats, tableHost),
    destroy() {
      if (unsub) unsub();
    },
  };
}
