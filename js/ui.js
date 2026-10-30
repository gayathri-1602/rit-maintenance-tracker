/**
 * ui.js
 * ---------------------------------------------------------------------------
 * A tiny "component kit" built on plain DOM APIs (no framework needed).
 *
 * Everything the app renders is created with `el()` instead of innerHTML, which
 * means user-supplied text is inserted as TEXT (never as HTML) - that is one of
 * our main defences against cross-site scripting (XSS).
 *
 * Exports: el, icons, toast, showLoader/hideLoader, confirmDialog, openModal,
 * form field builders, chips, statCard, dataTable, emptyState, sectionCard.
 */

import { escapeHtml } from './utils.js';

/* --------------------------------------------------------------- core DOM */

/**
 * Creates an element.
 *   el('div', { class: 'card' }, el('h2', {}, 'Hello'))
 * Special props: class, text, html (escape-free, use only for our own markup),
 * dataset, on* event handlers, value/checked/disabled.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value') node.value = value;
    else if (['checked', 'disabled', 'selected', 'hidden', 'required', 'multiple'].includes(key)) {
      node[key] = Boolean(value);
    } else node.setAttribute(key, value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  if (node) node.replaceChildren();
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

const $ = (id) => document.getElementById(id);

/* ----------------------------------------------------------------- icons */

/** Minimal inline SVG icon set (stroke icons, 20px). */
export const icons = {
  dashboard: 'M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  filter: 'M4 5h16M7 12h10M10 19h4',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  alert: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01',
  menu: 'M3 12h18M3 6h18M3 18h18',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export function icon(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', icons[name] || icons.file);
  svg.appendChild(path);
  return svg;
}

/* ---------------------------------------------------------------- toasts */

const TOAST_ICON = { success: 'check', error: 'alert', info: 'inbox', warning: 'alert' };

export function toast(message, type = 'info', timeout = 4500) {
  const root = $('toasts');
  if (!root) return;
  const node = el(
    'div',
    { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' },
    el('span', { class: 'toast__icon' }, icon(TOAST_ICON[type] || 'inbox', 18)),
    el('span', { class: 'toast__text', text: message }),
    el('button', {
      class: 'toast__close',
      type: 'button',
      'aria-label': 'Dismiss',
      onclick: () => dismiss(),
    }, icon('x', 16))
  );
  let timer;
  function dismiss() {
    clearTimeout(timer);
    node.classList.add('toast--leaving');
    setTimeout(() => node.remove(), 180);
  }
  root.appendChild(node);
  if (timeout > 0) timer = setTimeout(dismiss, timeout);
  return dismiss;
}

/* ---------------------------------------------------------------- loader */

let loaderDepth = 0;

export function showLoader(text = 'Working…') {
  loaderDepth += 1;
  const overlay = $('loader');
  const label = $('loaderText');
  if (label) label.textContent = text;
  if (overlay) overlay.hidden = false;
}

export function hideLoader() {
  loaderDepth = Math.max(0, loaderDepth - 1);
  if (loaderDepth === 0) {
    const overlay = $('loader');
    if (overlay) overlay.hidden = true;
  }
}

/** Wraps an async action with the global loading overlay. */
export async function withLoader(text, fn) {
  showLoader(text);
  try {
    return await fn();
  } finally {
    hideLoader();
  }
}

/* ---------------------------------------------------------------- modals */

let activeModal = null;

/**
 * Opens a modal dialog. Returns { close }.
 * The dialog is removed on backdrop click, the X button, or the Escape key.
 */
export function openModal({ title, body, footer, size = 'md', onClose } = {}) {
  const root = $('modalRoot');
  if (!root) return { close() {} };
  closeModal(); // only one modal at a time

  const card = el(
    'div',
    { class: `modal modal--${size}`, role: 'dialog', 'aria-modal': 'true' },
    el(
      'header',
      { class: 'modal__head' },
      el('h3', { class: 'modal__title', text: title || '' }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => close() }, icon('x', 18))
    ),
    el('div', { class: 'modal__body' }, body || frag()),
    footer ? el('footer', { class: 'modal__foot' }, footer) : null
  );

  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, card);
  root.replaceChildren(backdrop);
  root.hidden = false;
  activeModal = { root, close };

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  function close() {
    document.removeEventListener('keydown', onKey);
    root.hidden = true;
    root.replaceChildren();
    activeModal = null;
    if (typeof onClose === 'function') onClose();
  }

  // focus first focusable control for accessibility
  setTimeout(() => card.querySelector('button, input, select, textarea')?.focus(), 30);
  return { close };
}

function closeModal() {
  if (activeModal) activeModal.close();
}

/** Promise-based confirmation dialog. Resolves true when confirmed. */
export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      ref.close();
      resolve(value);
    };
    const ref = openModal({
      title,
      size: 'sm',
      body: el('p', { class: 'modal__text', text: message }),
      footer: frag(
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => finish(false) }, cancelLabel),
        el(
          'button',
          { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button', onclick: () => finish(true) },
          confirmLabel
        )
      ),
      onClose: () => finish(false),
    });
  });
}

/* ------------------------------------------------------ form field parts */

/** Wraps a control with a label, optional hint and inline error slot. */
export function field({ label, hint, required = false, control, id, error = '' }) {
  return el(
    'div',
    { class: 'field' },
    label
      ? el(
          'label',
          { class: 'field__label', for: id },
          label,
          required ? el('span', { class: 'field__req', text: ' *' }) : null
        )
      : null,
    control,
    hint ? el('p', { class: 'field__hint', text: hint }) : null,
    error ? el('p', { class: 'field__error', text: error }) : null
  );
}

export function textInput({ id, name, type = 'text', placeholder = '', value = '', required, autocomplete, minlength, maxlength, oninput, onchange }) {
  return el('input', {
    id, name, type, placeholder, value, required, autocomplete, minlength, maxlength, oninput, onchange,
    class: 'input',
  });
}

export function textarea({ id, name, placeholder = '', value = '', required, rows = 4, maxlength, oninput }) {
  return el('textarea', { id, name, placeholder, required, rows, maxlength, oninput, class: 'input input--area' }, value);
}

/**
 * A <select>. `options` can be strings or {value,label} objects.
 * `placeholder` adds a disabled first option.
 */
export function select({ id, name, options = [], value = '', required, placeholder = '', onchange }) {
  const node = el('select', { id, name, required, onchange, class: 'input' });
  if (placeholder) {
    node.appendChild(el('option', { value: '', disabled: required, selected: !value }, placeholder));
  }
  for (const opt of options) {
    const isObj = typeof opt === 'object' && opt !== null;
    const val = isObj ? opt.value : opt;
    const label = isObj ? opt.label : opt;
    node.appendChild(el('option', { value: val, selected: String(val) === String(value) }, label));
  }
  if (!value && !required && !placeholder) node.selectedIndex = -1;
  return node;
}

/* ------------------------------------------------------------------ chips */

export function chip(text, className = '') {
  return el('span', { class: `chip ${className}`.trim(), text });
}

export function priorityChip(priority) {
  const cls = { Low: 'chip--low', Medium: 'chip--medium', High: 'chip--high' }[priority] || '';
  return chip(priority || '—', cls);
}

export function statusChip(status) {
  const map = {
    Submitted: 'chip--submitted',
    Pending: 'chip--pending',
    'In Progress': 'chip--progress',
    Resolved: 'chip--resolved',
    Rejected: 'chip--rejected',
  };
  return chip(status || '—', map[status] || '');
}

/* ------------------------------------------------------------- structure */

/** A titled panel. `actions` renders on the right side of the header. */
export function sectionCard({ title, subtitle, actions, body, className = '', iconName }) {
  return el(
    'section',
    { class: `panel ${className}`.trim() },
    el(
      'header',
      { class: 'panel__head' },
      el(
        'div',
        { class: 'panel__titles' },
        el('h2', { class: 'panel__title' }, iconName ? icon(iconName, 18) : null, el('span', { text: title || '' })),
        subtitle ? el('p', { class: 'panel__subtitle', text: subtitle }) : null
      ),
      actions ? el('div', { class: 'panel__actions' }, actions) : null
    ),
    el('div', { class: 'panel__body' }, body)
  );
}

/** Dashboard statistic tile. `tone` is one of: blue, green, amber, red, violet. */
export function statCard({ label, value, tone = 'blue', iconName = 'chart', hint }) {
  return el(
    'article',
    { class: `stat stat--${tone}` },
    el('div', { class: 'stat__icon' }, icon(iconName, 22)),
    el(
      'div',
      { class: 'stat__body' },
      el('p', { class: 'stat__label', text: label }),
      el('p', { class: 'stat__value', text: String(value ?? 0) }),
      hint ? el('p', { class: 'stat__hint', text: hint }) : null
    )
  );
}

/** Friendly placeholder when a list has no rows. */
export function emptyState({ title = 'Nothing here yet', message = '', actionLabel, onAction, iconName = 'inbox' } = {}) {
  return el(
    'div',
    { class: 'empty' },
    el('div', { class: 'empty__art' }, icon(iconName, 40)),
    el('h3', { class: 'empty__title', text: title }),
    message ? el('p', { class: 'empty__text', text: message }) : null,
    actionLabel && onAction
      ? el('button', { class: 'btn btn--primary', type: 'button', onclick: onAction }, icon('plus', 16), actionLabel)
      : null
  );
}

/**
 * Sortable, filter-friendly table.
 * `columns`: [{ key, label, sortable, sortValue(row), render(row), width, align }]
 * Returns { element, setRows(rows) } so callers can refresh data in place.
 */
export function dataTable({ columns, rows = [], emptyMessage = 'No records found.', pageSize = 0, onRowClick = null }) {
  const table = el('table', { class: 'table' });
  const thead = el('thead');
  const tbody = el('tbody');
  table.append(thead, tbody);
  const wrapper = el('div', { class: 'table-wrap' }, table);
  const footer = el('div', { class: 'table-foot' });
  const root = el('div', { class: 'table-block' }, wrapper, footer);

  let data = [...rows];
  let sortKey = null;
  let sortDir = 'asc';
  let page = 1;

  function sortValueFor(row, col) {
    if (col.sortValue) return col.sortValue(row);
    return row[col.key];
  }

  function renderHead() {
    clear(thead);
    const tr = el('tr');
    for (const col of columns) {
      const isSorted = sortKey === col.key;
      const th = el(
        'th',
        {
          class: `${col.sortable ? 'is-sortable' : ''} ${col.align === 'right' ? 'is-right' : ''} ${isSorted ? 'is-sorted' : ''}`.trim(),
          style: col.width ? { width: col.width } : null,
        },
        el('span', { class: 'th__label', text: col.label }),
        col.sortable ? el('span', { class: 'th__arrow', text: isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '↕' }) : null
      );
      if (col.sortable) {
        th.addEventListener('click', () => {
          if (sortKey === col.key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else { sortKey = col.key; sortDir = 'asc'; }
          renderHead();
          renderBody();
        });
      }
      tr.appendChild(th);
    }
    thead.appendChild(tr);
  }

  function sortedData() {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...data].sort((a, b) => {
      const av = sortValueFor(a, col);
      const bv = sortValueFor(b, col);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }

  function renderBody() {
    clear(tbody);
    clear(footer);
    const all = sortedData();
    if (!all.length) {
      const td = el('td', { class: 'table__empty', colspan: String(columns.length) }, emptyState({ title: emptyMessage }));
      tbody.appendChild(el('tr', {}, td));
      return;
    }
    const totalPages = pageSize ? Math.max(1, Math.ceil(all.length / pageSize)) : 1;
    page = Math.min(page, totalPages);
    const start = pageSize ? (page - 1) * pageSize : 0;
    const visible = pageSize ? all.slice(start, start + pageSize) : all;

    for (const row of visible) {
      const tr = el('tr', { class: onRowClick ? 'is-clickable' : '' });
      if (onRowClick) tr.addEventListener('click', () => onRowClick(row));
      for (const col of columns) {
        const content = col.render ? col.render(row) : escapeHtml(row[col.key]);
        const td = el('td', { class: col.align === 'right' ? 'is-right' : '' });
        if (content instanceof Node) td.appendChild(content);
        else td.textContent = content == null ? '—' : String(content);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    if (pageSize && all.length > pageSize) {
      footer.append(
        el('span', { class: 'table-foot__info', text: `Showing ${start + 1}–${Math.min(start + visible.length, all.length)} of ${all.length}` }),
        el(
          'div',
          { class: 'table-foot__pager' },
          el('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: page <= 1, onclick: () => { page -= 1; renderBody(); } }, 'Previous'),
          el('span', { class: 'table-foot__page', text: `Page ${page} of ${totalPages}` }),
          el('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: page >= totalPages, onclick: () => { page += 1; renderBody(); } }, 'Next')
        )
      );
    }
  }

  renderHead();
  renderBody();

  return {
    element: root,
    setRows(next) {
      data = [...next];
      page = 1;
      renderBody();
    },
    getRows() {
      return data;
    },
  };
}

/**
 * Horizontal status tracker shown on a complaint detail page.
 * When the status is "Rejected" the flow stops early.
 */
export function progressTracker(status) {
  const flow = status === 'Rejected'
    ? ['Submitted', 'Rejected']
    : ['Submitted', 'Pending', 'In Progress', 'Resolved'];
  const activeIndex = flow.indexOf(status);
  const root = el('ol', { class: 'tracker' });
  flow.forEach((step, index) => {
    const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo';
    root.appendChild(
      el(
        'li',
        { class: `tracker__step tracker__step--${state}${step === 'Rejected' ? ' tracker__step--rejected' : ''}` },
        el('span', { class: 'tracker__dot' }, state === 'done' ? icon('check', 14) : el('span', { class: 'tracker__num', text: String(index + 1) })),
        el('span', { class: 'tracker__label', text: step })
      )
    );
  });
  return root;
}

/**
 * Vertical activity timeline.
 * `items`: [{ title, meta, remark, iconName }]
 */
export function timeline(items = []) {
  const root = el('div', { class: 'timeline' });
  if (!items.length) {
    root.appendChild(el('p', { class: 'muted', text: 'No activity recorded yet.' }));
    return root;
  }
  for (const item of items) {
    root.appendChild(
      el(
        'div',
        { class: 'timeline__item' },
        el('div', { class: 'timeline__dot' }, icon(item.iconName || 'clock', 15)),
        el(
          'div',
          { class: 'timeline__body' },
          el('div', { class: 'timeline__title', text: item.title || '' }),
          el('div', { class: 'timeline__meta', text: item.meta || '' }),
          item.remark ? el('div', { class: 'timeline__remark', text: item.remark }) : null
        )
      )
    );
  }
  return root;
}

/** Read-only key/value grid used in detail views. */
export function detailList(items) {
  const dl = el('dl', { class: 'detail-list' });
  for (const { label, value } of items) {
    dl.append(
      el('div', { class: 'detail-list__row' },
        el('dt', { text: label }),
        el('dd', {}, value instanceof Node ? value : el('span', { text: value == null || value === '' ? '—' : String(value) }))
      )
    );
  }
  return dl;
}
