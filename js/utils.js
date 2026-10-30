/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Small, dependency-free helper functions used all over the app:
 * formatting dates, validating input, escaping text, building CSV exports, etc.
 * Nothing here touches Firebase, so it is easy to reason about and reuse.
 */

import { Timestamp } from './firebase.js';

/* ------------------------------------------------------------------ dates */

/** Converts any of Firestore Timestamp | Date | string | number to a Date. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate(); // Firestore Timestamp
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Mar 2026, 4:05 PM" - used in tables and detail views. */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** "12 Mar 2026" - used where only the day matters. */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "3 hours ago" - friendly relative time for activity feeds. */
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '—';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  const table = [
    [60, 'second', 1],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [604800, 'day', 86400],
    [2629800, 'week', 604800],
    [31557600, 'month', 2629800],
  ];
  for (const [limit, unit, div] of table) {
    if (seconds < limit) {
      const n = Math.max(1, Math.round(seconds / div));
      return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
  }
  const years = Math.max(1, Math.round(seconds / 31557600));
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/** ISO string (yyyy-mm-dd) helper for <input type="date"> defaults. */
export function isoDate(value = new Date()) {
  const d = toDate(value) || new Date();
  return d.toISOString().slice(0, 10);
}

/** Timestamp for "now", as a Firestore server timestamp. */
export function now() {
  return Timestamp.now();
}

/* ------------------------------------------------------------- validation */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGNO_RE = /^[A-Za-z0-9/-]{4,20}$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

export function isValidRegisterNumber(regNo) {
  return REGNO_RE.test(String(regNo || '').trim());
}

/**
 * Password policy: minimum 8 characters with at least one letter and one digit.
 * Returned as an object so the UI can show *why* it failed.
 */
export function checkPassword(password) {
  const value = String(password || '');
  const problems = [];
  if (value.length < 8) problems.push('at least 8 characters');
  if (!/[A-Za-z]/.test(value)) problems.push('one letter');
  if (!/\d/.test(value)) problems.push('one number');
  return { valid: problems.length === 0, problems };
}

/** Turns Firebase error codes into messages a student can actually act on. */
export function friendlyAuthError(error) {
  const code = error?.code || '';
  const map = {
    'auth/email-already-in-use': 'That email is already registered. Try signing in or reset your password.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'That password is too weak. Use at least 8 characters with a letter and a number.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network problem. Check your internet connection.',
    'auth/requires-recent-login': 'Please sign out and sign in again before changing this.',
    'permission-denied': 'You do not have permission to perform that action.',
    'storage/unauthorized': 'You are not allowed to upload or read this file.',
    'storage/canceled': 'The upload was cancelled.',
  };
  return map[code] || error?.message || 'Something went wrong. Please try again.';
}

/* ------------------------------------------------------------------ files */

/**
 * Validates a File object against the allowed types and the 10 MB limit.
 * Returns { ok: true } or { ok: false, reason: '...' }.
 */
export function validateAttachment(file, { maxBytes, allowedPrefixes, allowedTypes }) {
  if (!file) return { ok: true };
  const type = file.type || '';
  const typeAllowed =
    allowedPrefixes.some((p) => type.startsWith(p)) || allowedTypes.includes(type);
  if (!typeAllowed) {
    return { ok: false, reason: 'Only images (JPG/PNG/…), videos (MP4/…) and PDF files are allowed.' };
  }
  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, reason: `File is too large. Maximum allowed size is ${mb} MB.` };
  }
  return { ok: true };
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = Number(bytes);
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Guesses a coarse kind from a MIME type, used to pick a preview widget. */
export function attachmentKind(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'file';
}

/* -------------------------------------------------------------- text / misc */

/** Escapes HTML so any user-supplied text can never inject markup. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Aarthi Raman" -> "AR" (avatar fallback). */
export function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';
}

/** Title-cases a role key for display. */
export function titleCase(value = '') {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Delays running a function until the user stops typing (for search boxes). */
export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Sorts an array of objects by a key, ascending or descending. */
export function sortBy(list, key, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
}

/**
 * Builds a CSV string from rows and triggers a browser download.
 * Used by the Super Admin "Export complaint reports" button.
 */
export function downloadCsv(filename, headers, rows) {
  const escapeCell = (cell) => {
    const value = cell == null ? '' : String(cell);
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  const lines = [headers.map(escapeCell).join(',')];
  rows.forEach((row) => lines.push(row.map(escapeCell).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Groups a list into buckets, e.g. countByStatus(list, 'status'). */
export function countBy(list, key) {
  return list.reduce((acc, item) => {
    const k = item?.[key] ?? 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

/** Sleep helper for small UX delays (used sparingly). */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
