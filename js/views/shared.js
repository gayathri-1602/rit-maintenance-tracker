/**
 * views/shared.js
 * ---------------------------------------------------------------------------
 * Pieces reused by more than one screen (complaint list, detail page, feedback
 * page…). Keeping them here means we never duplicate the same table cell or the
 * same attachment viewer in two files.
 */

import { el, icon, openModal, chip, statusChip, priorityChip, detailList } from '../ui.js';
import { subscribeComplaints } from '../complaints.js';
import { formatDateTime, formatBytes, attachmentKind } from '../utils.js';

/** Subscribes to the complaints this role may read. */
export function liveComplaints(ctx, onData, onError) {
  return subscribeComplaints(ctx.profile, onData, onError);
}

/** Human-readable complaint location ("RIT Hostel • Room 214 • 2nd floor"). */
export function locationText(complaint) {
  if (!complaint) return '—';
  if (complaint.complaintType === 'Hostel') {
    const parts = [complaint.hostelName || 'Hostel'];
    if (complaint.roomNumber) parts.push(`Room ${complaint.roomNumber}`);
    if (complaint.floor) parts.push(complaint.floor);
    return parts.join(' • ');
  }
  const parts = ['College campus'];
  if (complaint.venue) parts.push(complaint.venue);
  if (complaint.roomNumber) parts.push(`Room ${complaint.roomNumber}`);
  return parts.join(' • ');
}

/** The short, shareable complaint ID. */
export function codeChip(complaint) {
  return el('span', { class: 'chip chip--submitted', text: complaint?.complaintCode || complaint?.id || '—' });
}

/** Attachment link/thumbnail cell for tables. */
export function attachmentCell(complaint) {
  const attachment = complaint?.attachment;
  if (!attachment?.url) return el('span', { class: 'faint', text: 'None' });
  return el(
    'button',
    {
      class: 'btn btn--link btn--sm',
      type: 'button',
      onclick: () => openAttachmentViewer(attachment),
    },
    icon('eye', 15),
    attachmentKind(attachment.contentType) === 'image' ? 'Image' : attachmentKind(attachment.contentType) === 'video' ? 'Video' : 'PDF'
  );
}

/** Full-screen viewer for an attachment (image / video / PDF). */
export function openAttachmentViewer(attachment) {
  if (!attachment?.url) return;
  const kind = attachment.kind || attachmentKind(attachment.contentType);
  let preview;
  if (kind === 'image') {
    preview = el('img', { src: attachment.url, alt: attachment.name || 'Attachment', class: 'attach-viewer' });
  } else if (kind === 'video') {
    preview = el('video', { src: attachment.url, controls: true, class: 'attach-viewer' });
  } else {
    preview = el('iframe', { src: attachment.url, title: attachment.name || 'Attachment', class: 'attach-viewer',
      style: { width: '100%', height: '70vh', border: '1px solid var(--border)' } });
  }

  openModal({
    title: attachment.name || 'Attachment',
    size: 'lg',
    body: el('div', { class: 'stack' }, preview,
      el('div', { class: 'row row--between' },
        el('span', { class: 'muted', text: `${attachment.contentType || 'file'} • ${formatBytes(attachment.size)}` }),
        el('a', { class: 'btn btn--ghost btn--sm', href: attachment.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open in new tab')
      )
    ),
  });
}

/** Detail grid describing the student and complaint metadata. */
export function complaintDetailsBlock(complaint, { showStudent = true } = {}) {
  const items = [];
  if (complaint.complaintCode) items.push({ label: 'Complaint ID', value: complaint.complaintCode });
  items.push({ label: 'Type', value: complaint.complaintType });
  items.push({ label: 'Category', value: complaint.category });
  items.push({ label: 'Priority', value: priorityChip(complaint.priority) });
  items.push({ label: 'Status', value: statusChip(complaint.status) });
  items.push({ label: 'Location', value: locationText(complaint) });
  if (showStudent) {
    items.push({ label: 'Student name', value: complaint.studentName });
    items.push({ label: 'Register number', value: complaint.registerNumber });
    if (complaint.complaintType === 'College') {
      items.push({ label: 'Department', value: complaint.department });
      items.push({ label: 'Year', value: complaint.year });
      items.push({ label: 'Section', value: complaint.section });
    }
  }
  items.push({ label: 'Submitted on', value: formatDateTime(complaint.createdAt) });
  items.push({ label: 'Last updated', value: formatDateTime(complaint.updatedAt) });
  if (complaint.assignedAdminName) items.push({ label: 'Handled by', value: complaint.assignedAdminName });
  if (complaint.resolvedAt) items.push({ label: 'Resolved on', value: formatDateTime(complaint.resolvedAt) });
  return detailList(items);
}

/** Small "2 days ago" style stamp used in list rows. */
export function updatedStamp(complaint) {
  return el('span', { class: 'faint', text: formatDateTime(complaint.updatedAt) });
}

/** Renders N gold stars (read-only). */
export function starRating(rating = 0) {
  const wrap = el('span', { class: 'star-static' });
  for (let i = 1; i <= 5; i += 1) {
    const svg = icon('star', 14);
    svg.setAttribute('fill', i <= rating ? 'currentColor' : 'none');
    svg.setAttribute('stroke', i <= rating ? 'currentColor' : 'var(--border-strong)');
    wrap.appendChild(svg);
  }
  return wrap;
}

/** Reusable "no permission / no data" notice. */
export function noticeBox(text, tone = 'info') {
  return el('div', { class: `notice notice--${tone}` }, icon(tone === 'danger' ? 'alert' : 'inbox', 18), el('span', { text }));
}
