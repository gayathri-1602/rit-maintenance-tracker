/**
 * views/complaint-actions.js
 * ---------------------------------------------------------------------------
 * The dialogs that change a complaint:
 *   - openUpdateModal  : admin sets status / priority and adds a remark
 *   - openFeedbackModal: student rates a resolved complaint
 *   - openStudentModal : admin inspects the student's details
 *
 * These live in one file so the list page, the detail page and the feedback page
 * all behave identically.
 */

import { el, icon, openModal, field, textarea, select, confirmDialog, detailList } from '../ui.js';
import { applyAdminUpdate, submitFeedback } from '../complaints.js';
import { STATUSES, PRIORITIES } from '../constants.js';
import { formatDateTime, friendlyAuthError } from '../utils.js';
import { locationText, starRating } from './shared.js';

/* ------------------------------------------------- admin: update workflow */

export function openUpdateModal(ctx, complaint, onDone) {
  const status = select({
    id: 'updStatus',
    options: STATUSES,
    value: complaint.status || 'Pending',
  });
  const priority = select({
    id: 'updPriority',
    options: PRIORITIES,
    value: complaint.priority || 'Medium',
  });
  const remark = textarea({
    id: 'updRemark',
    placeholder: 'What action was taken? e.g. "Electrician replaced the faulty switch board."',
    rows: 4,
  });
  if (complaint.adminRemarks) remark.value = complaint.adminRemarks;

  const hint = el('p', { class: 'muted' }, 'Changing the status or priority is recorded in the complaint history.');

  const modal = openModal({
    title: `Update ${complaint.complaintCode || 'complaint'}`,
    size: 'md',
    body: el(
      'div',
      { class: 'stack' },
      el('div', { class: 'grid-form' },
        field({ label: 'Status', control: status, id: 'updStatus' }),
        field({ label: 'Priority', control: priority, id: 'updPriority' })
      ),
      field({ label: 'Remark / action taken', control: remark, id: 'updRemark', hint: 'Visible to the student in their complaint timeline.' }),
      hint
    ),
    footer: el(
      'div',
      { class: 'row' },
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => modal.close() }, 'Cancel'),
      el(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          onclick: async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
              await applyAdminUpdate(
                complaint,
                { status: status.value, priority: priority.value, remark: remark.value.trim() },
                ctx.profile
              );
              ctx.toast('Complaint updated successfully.', 'success');
              modal.close();
              if (typeof onDone === 'function') onDone();
            } catch (error) {
              ctx.toast(friendlyAuthError(error), 'error');
            } finally {
              button.disabled = false;
            }
          },
        },
        'Save changes'
      )
    ),
  });
}

/** Quick action: jump straight to Resolved with a confirmation step. */
export async function markResolved(ctx, complaint, onDone) {
  const ok = await confirmDialog({
    title: 'Mark as resolved?',
    message: `Complaint ${complaint.complaintCode || complaint.id} will be closed and the student will be able to leave feedback.`,
    confirmLabel: 'Mark resolved',
  });
  if (!ok) return;
  try {
    await applyAdminUpdate(complaint, { status: 'Resolved', remark: 'Marked as resolved.' }, ctx.profile);
    ctx.toast('Complaint marked as resolved.', 'success');
    if (typeof onDone === 'function') onDone();
  } catch (error) {
    ctx.toast(friendlyAuthError(error), 'error');
  }
}

/* ----------------------------------------------------- student: feedback */

export function openFeedbackModal(ctx, complaint, onDone) {
  let rating = complaint.feedback?.rating || 0;
  const stars = el('div', { class: 'stars' });
  const starButtons = [];
  for (let i = 1; i <= 5; i += 1) {
    const button = el('button', {
      class: 'star-btn',
      type: 'button',
      'aria-label': `${i} star${i > 1 ? 's' : ''}`,
      onclick: () => {
        rating = i;
        paint();
      },
    }, icon('star', 26));
    starButtons.push(button);
    stars.appendChild(button);
  }
  function paint() {
    starButtons.forEach((button, index) => {
      const on = index + 1 <= rating;
      button.classList.toggle('is-on', on);
      const svg = button.querySelector('svg');
      svg.setAttribute('fill', on ? 'currentColor' : 'none');
    });
  }
  paint();

  const comment = textarea({ id: 'fbComment', placeholder: 'How was the service? (optional)', rows: 3 });

  const modal = openModal({
    title: 'Submit feedback',
    size: 'md',
    body: el('div', { class: 'stack' },
      el('p', { class: 'muted' }, `Complaint ${complaint.complaintCode || complaint.id} • ${complaint.category} • ${locationText(complaint)}`),
      field({ label: 'Your rating', control: stars, id: 'fbStars' }),
      field({ label: 'Comments', control: comment, id: 'fbComment' })
    ),
    footer: el('div', { class: 'row' },
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => modal.close() }, 'Cancel'),
      el('button', {
        class: 'btn btn--primary',
        type: 'button',
        onclick: async (event) => {
          if (!rating) return ctx.toast('Please choose a rating between 1 and 5.', 'error');
          const button = event.currentTarget;
          button.disabled = true;
          try {
            await submitFeedback(complaint.id, { rating, comment: comment.value.trim() }, ctx.profile);
            ctx.toast('Thank you! Your feedback has been recorded.', 'success');
            modal.close();
            if (typeof onDone === 'function') onDone();
          } catch (error) {
            ctx.toast(friendlyAuthError(error), 'error');
          } finally {
            button.disabled = false;
          }
        },
      }, 'Submit feedback')
    ),
  });
}

/* ----------------------------------------------- admin: student details */

export function openStudentModal(student, complaint) {
  const rows = [
    { label: 'Student name', value: student?.fullName || complaint?.studentName },
    { label: 'Register number', value: student?.regNo || complaint?.registerNumber },
    { label: 'Email', value: student?.email || complaint?.studentEmail },
    { label: 'Department', value: student?.department || complaint?.department },
    { label: 'Year', value: student?.year || complaint?.year },
    { label: 'Section', value: student?.section || complaint?.section },
    { label: 'Account status', value: student ? (student.active === false ? 'Deactivated' : 'Active') : '—' },
    { label: 'Registered on', value: student ? formatDateTime(student.createdAt) : '—' },
  ];
  let modal;
  modal = openModal({
    title: 'Student details',
    size: 'sm',
    body: detailList(rows),
    footer: el('div', { class: 'row' }, el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => modal.close() }, 'Close')),
  });
  return modal;
}
