/**
 * views/complaint-detail.js
 * ---------------------------------------------------------------------------
 * The full complaint page: status tracker, every field, the attachment, the
 * complete update history, and (depending on role) the admin actions or the
 * student feedback form.
 *
 * Route: #/complaints/:id
 */

import { el, icon, sectionCard, progressTracker, timeline, emptyState, noticeBox } from '../ui.js';
import { ROLES } from '../constants.js';
import { subscribeComplaint, subscribeComplaintUpdates } from '../complaints.js';
import { complaintDetailsBlock, openAttachmentViewer, starRating, locationText, codeChip } from './shared.js';
import { openUpdateModal, markResolved, openFeedbackModal, openStudentModal } from './complaint-actions.js';
import { formatDateTime, friendlyAuthError, attachmentKind, formatBytes } from '../utils.js';
import { navigate } from '../router.js';

export function createComplaintDetail(ctx, complaintId) {
  let unsubComplaint = null;
  let unsubUpdates = null;
  let missing = false;
  const isAdmin = [ROLES.COLLEGE_ADMIN, ROLES.HOSTEL_ADMIN, ROLES.SUPER_ADMIN].includes(ctx.profile.role);

  const header = el('div', { class: 'row row--between' },
    el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => navigate('/complaints') },
      icon('x', 14), 'Back to complaints')
  );

  const content = el('div', { class: 'stack' });

  unsubComplaint = subscribeComplaint(
    complaintId,
    (complaint) => {
      if (!complaint) {
        missing = true;
        content.replaceChildren(emptyState({
          title: 'Complaint not found',
          message: 'This complaint no longer exists, or you do not have access to it.',
          iconName: 'alert',
          actionLabel: 'Back to my complaints',
          onAction: () => navigate('/complaints'),
        }));
        return;
      }
      render(complaint);
    },
    (error) => {
      content.replaceChildren(noticeBox(`Unable to open this complaint: ${friendlyAuthError(error)}`, 'danger'));
    }
  );

  function render(complaint) {
    const panels = [];

    /* ------------------------------------------------ main complaint card */
    panels.push(
      sectionCard({
        title: complaint.category || 'Complaint',
        subtitle: `${complaint.complaintType} maintenance • ${locationText(complaint)}`,
        iconName: complaint.complaintType === 'Hostel' ? 'home' : 'building',
        actions: complaintDetailsActions(complaint),
        body: el('div', { class: 'stack' },
          el('div', { class: 'row row--between' },
            codeChip(complaint),
            el('span', { class: 'faint', text: `Last updated ${formatDateTime(complaint.updatedAt)}` })
          ),
          progressTracker(complaint.status),
          el('p', { class: 'muted', style: { whiteSpace: 'pre-wrap' } }, complaint.description || '—'),
          attachmentBlock(complaint),
          complaint.adminRemarks
            ? el('div', { class: 'notice notice--info' }, icon('inbox', 18),
                el('div', {}, el('strong', { text: 'Latest admin remark: ' }), el('span', { text: complaint.adminRemarks })))
            : null
        ),
      })
    );

    /* -------------------------------------------------------- details grid */
    panels.push(
      sectionCard({
        title: 'Complaint details',
        iconName: 'list',
        body: complaintDetailsBlock(complaint),
      })
    );

    /* ----------------------------------------------------------- feedback */
    panels.push(feedbackPanel(complaint));

    /* ------------------------------------------------------------ history */
    const historyBody = el('div', {}, el('p', { class: 'muted', text: 'Loading history…' }));
    panels.push(sectionCard({ title: 'Update history', iconName: 'clock', body: historyBody }));

    content.replaceChildren(...panels);

    // Subscribe to the history log (see renderHistory below)
    renderHistory(complaint, historyBody);
  }

  function complaintDetailsActions(complaint) {
    const row = el('div', { class: 'row' });
    if (isAdmin) {
      row.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button',
        onclick: () => openStudentModal(studentFromComplaint(complaint), complaint),
      }, icon('user', 15), 'Student details'));
      row.appendChild(el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openUpdateModal(ctx, complaint, () => {}),
      }, 'Update status'));
      if (complaint.status !== 'Resolved' && complaint.status !== 'Rejected') {
        row.appendChild(el('button', {
          class: 'btn btn--success btn--sm', type: 'button',
          onclick: () => markResolved(ctx, complaint, () => {}),
        }, icon('check', 15), 'Resolve'));
      }
    }
    return row;
  }

  function attachmentBlock(complaint) {
    const a = complaint.attachment;
    if (!a?.url) {
      return el('div', { class: 'notice' }, icon('file', 18), el('span', { text: 'No attachment was provided with this complaint.' }));
    }
    const kind = a.kind || attachmentKind(a.contentType);
    const thumb = kind === 'image'
      ? el('img', { class: 'attach-thumb', src: a.url, alt: '' })
      : el('div', { class: 'attach-card__icon' }, icon('file', 20));
    return el('div', { class: 'attach-card' },
      thumb,
      el('div', { class: 'grow' },
        el('div', { style: { fontWeight: '600', wordBreak: 'break-all' }, text: a.name || 'Attachment' }),
        el('div', { class: 'faint', text: `${a.contentType || 'file'} • ${formatBytes(a.size)}` })
      ),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => openAttachmentViewer(a) },
        icon('eye', 14), 'Preview')
    );
  }

  function feedbackPanel(complaint) {
    const body = el('div', { class: 'stack' });
    if (complaint.feedback) {
      body.append(
        el('div', { class: 'rating-summary' },
          el('div', { class: 'rating-summary__score', text: String(complaint.feedback.rating) }),
          el('div', {},
            starRating(complaint.feedback.rating),
            el('div', { class: 'faint', text: `by ${complaint.feedback.byName || 'student'} • ${formatDateTime(complaint.feedback.createdAt)}` })
          )
        ),
        complaint.feedback.comment ? el('p', { class: 'muted', text: complaint.feedback.comment }) : null
      );
    } else if (complaint.status === 'Resolved') {
      if (ctx.profile.role === ROLES.STUDENT) {
        body.append(
          el('p', { class: 'muted', text: 'Your complaint has been resolved. Please let us know how it went.' }),
          el('button', { class: 'btn btn--primary', type: 'button', onclick: () => openFeedbackModal(ctx, complaint, () => {}) },
            icon('star', 15), 'Leave feedback')
        );
      } else {
        body.append(el('p', { class: 'muted', text: 'Resolved — waiting for the student to leave feedback.' }));
      }
    } else {
      body.append(el('p', { class: 'muted', text: 'Feedback opens once the complaint is marked as resolved.' }));
    }
    return sectionCard({ title: 'Student feedback', iconName: 'star', body });
  }

  function renderHistory(complaint, host) {
    if (unsubUpdates) unsubUpdates();
    unsubUpdates = subscribeComplaintUpdates(
      complaintId,
      (rows) => {
        const items = [
          {
            title: 'Complaint submitted',
            meta: formatDateTime(complaint.createdAt),
            remark: '',
            iconName: 'plus',
          },
          ...rows.map((row) => ({
            title: `Status set to "${row.status}" (priority: ${row.priority})`,
            meta: `${formatDateTime(row.at)} • ${row.byName || row.byRole || 'admin'}`,
            remark: row.remark,
            iconName: row.status === 'Resolved' ? 'check' : 'clock',
          })),
        ];
        host.replaceChildren(timeline(items));
      },
      () => host.replaceChildren(el('p', { class: 'muted', text: 'Could not load the update history.' }))
    );
  }

  function studentFromComplaint(complaint) {
    return {
      fullName: complaint.studentName,
      regNo: complaint.registerNumber,
      email: complaint.studentEmail,
      department: complaint.department,
      year: complaint.year,
      section: complaint.section,
      active: true,
      createdAt: complaint.createdAt,
    };
  }

  return {
    element: el('div', { class: 'stack' }, header, content),
    destroy() {
      if (unsubComplaint) unsubComplaint();
      if (unsubUpdates) unsubUpdates();
    },
  };
}
