/**
 * views/shell.js
 * ---------------------------------------------------------------------------
 * The signed-in layout: sidebar navigation + top bar + a content slot.
 *
 * The shell is created ONCE per login and the routed page is swapped into
 * `.content` (#pageSlot). That keeps the sidebar stable (no flicker) while the
 * user moves between screens.
 */

import { el, icon } from '../ui.js';
import { ROLE_LABELS, ROLES } from '../constants.js';
import { initials } from '../utils.js';
import { logout } from '../auth.js';

/** Navigation menu per role. Keeps each dashboard focused on its own job. */
export const NAV_BY_ROLE = {
  [ROLES.STUDENT]: [
    { section: 'Student' },
    { path: '/dashboard', label: 'Dashboard', iconName: 'dashboard' },
    { path: '/new', label: 'Submit complaint', iconName: 'plus' },
    { path: '/complaints', label: 'My complaints', iconName: 'list' },
    { path: '/profile', label: 'My profile', iconName: 'user' },
  ],
  [ROLES.COLLEGE_ADMIN]: [
    { section: 'College Admin' },
    { path: '/dashboard', label: 'Dashboard', iconName: 'dashboard' },
    { path: '/complaints', label: 'College complaints', iconName: 'building' },
    { path: '/feedback', label: 'Student feedback', iconName: 'star' },
    { path: '/profile', label: 'My profile', iconName: 'user' },
  ],
  [ROLES.HOSTEL_ADMIN]: [
    { section: 'Hostel Admin' },
    { path: '/dashboard', label: 'Dashboard', iconName: 'dashboard' },
    { path: '/complaints', label: 'Hostel complaints', iconName: 'home' },
    { path: '/feedback', label: 'Student feedback', iconName: 'star' },
    { path: '/profile', label: 'My profile', iconName: 'user' },
  ],
  [ROLES.SUPER_ADMIN]: [
    { section: 'Super Admin' },
    { path: '/dashboard', label: 'Dashboard', iconName: 'dashboard' },
    { path: '/complaints', label: 'All complaints', iconName: 'list' },
    { path: '/students', label: 'Students', iconName: 'users' },
    { path: '/admins', label: 'Admin accounts', iconName: 'shield' },
    { path: '/categories', label: 'Categories', iconName: 'tag' },
    { path: '/feedback', label: 'Feedback', iconName: 'star' },
    { path: '/profile', label: 'My profile', iconName: 'user' },
  ],
};

/** The title + subtitle shown in the top bar for a given content path. */
const TITLES = {
  '/dashboard': ['Dashboard', 'Overview of maintenance activity'],
  '/new': ['Submit a complaint', 'Report a college or hostel maintenance issue'],
  '/complaints': ['Complaints', 'Search, filter and manage complaints'],
  '/students': ['Registered students', 'Every student account in the system'],
  '/admins': ['Admin accounts', 'Create and manage admin access'],
  '/categories': ['Complaint categories', 'Control the options students can pick'],
  '/feedback': ['Student feedback', 'Ratings and comments after resolution'],
  '/profile': ['My profile', 'Your account information and password'],
};

export function createShell(ctx) {
  const profile = ctx.profile;
  const navItems = NAV_BY_ROLE[profile.role] || NAV_BY_ROLE[ROLES.STUDENT];
  let activePath = '/dashboard';

  /* ----------------------------------------------------------- sidebar -- */

  const navButtons = navItems
    .filter((item) => item.path)
    .map((item) =>
      el(
        'button',
        {
          class: 'nav-link',
          type: 'button',
          dataset: { path: item.path },
          onclick: () => {
            closeMobileNav();
            window.location.hash = `#${item.path}`;
          },
        },
        icon(item.iconName, 20),
        el('span', { text: item.label })
      )
    );

  const sidebar = el(
    'aside',
    { class: 'sidebar' },
    el(
      'div',
      { class: 'sidebar__brand' },
      el('img', { src: 'assets/logo.svg', alt: '' }),
      el('div', {},
        el('div', { class: 'sidebar__name', text: 'RIT Maintenance' }),
        el('div', { class: 'sidebar__tag', text: 'Complaint Portal' })
      )
    ),
    ...navItems.map((item) =>
      item.section ? el('div', { class: 'sidebar__section', text: item.section }) : null
    ).filter(Boolean),
    el('nav', { class: 'stack', style: { gap: '2px' } }, ...navButtons),
    el(
      'div',
      { class: 'sidebar__foot' },
      el(
        'div',
        { class: 'sidebar__user' },
        el('div', { class: 'avatar' }, initials(profile.fullName || profile.email)),
        el('div', { class: 'grow' },
          el('div', { class: 'sidebar__user-name', text: profile.fullName || 'Unnamed user' }),
          el('div', { class: 'sidebar__user-role', text: ROLE_LABELS[profile.role] + (profile.hostelName ? ` • ${profile.hostelName}` : '') })
        )
      ),
      el(
        'button',
        {
          class: 'nav-link',
          type: 'button',
          style: { marginTop: '8px' },
          onclick: async () => {
            await logout();
            ctx.toast('You have been signed out.', 'info');
            window.location.hash = '#/login';
          },
        },
        icon('logout', 20),
        el('span', { text: 'Sign out' })
      )
    )
  );

  /* ------------------------------------------------------------ top bar -- */

  const titleEl = el('div', { class: 'topbar__title', text: 'Dashboard' });
  const subEl = el('div', { class: 'topbar__sub', text: '' });

  const hamburger = el(
    'button',
    { class: 'icon-btn hamburger', type: 'button', 'aria-label': 'Open navigation', onclick: () => toggleMobileNav() },
    icon('menu', 20)
  );

  const topbar = el(
    'header',
    { class: 'topbar' },
    hamburger,
    el('div', {}, titleEl, subEl),
    el('div', { class: 'topbar__spacer' }),
    el('div', { class: 'row', style: { gap: '8px' } },
      el('span', { class: 'chip', text: ROLE_LABELS[profile.role] }),
      el('div', { class: 'avatar avatar--sm' }, initials(profile.fullName || profile.email))
    )
  );

  const pageSlot = el('div', { class: 'content' });

  const main = el('div', { class: 'main' }, topbar, pageSlot);
  const shell = el('div', { class: 'app-shell' }, sidebar, main);

  /* -------------------------------------------------- mobile behaviour -- */

  let backdrop = null;
  function toggleMobileNav() {
    shell.classList.toggle('nav-open');
    const open = shell.classList.contains('nav-open');
    if (open && !backdrop) {
      backdrop = el('div', { class: 'nav-backdrop', onclick: () => closeMobileNav() });
      shell.appendChild(backdrop);
    } else if (!open && backdrop) {
      backdrop.remove();
      backdrop = null;
    }
  }
  function closeMobileNav() {
    shell.classList.remove('nav-open');
    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
  }

  /* --------------------------------------------------------- public API -- */

  function setActiveNav(path) {
    activePath = path;
    navButtons.forEach((button) => {
      const target = button.dataset.path;
      const isActive = path === target || (target !== '/dashboard' && path.startsWith(target));
      button.classList.toggle('is-active', isActive);
    });
  }

  function setPage({ path, title, subtitle, node }) {
    const meta = TITLES[path] || ['', ''];
    titleEl.textContent = title || meta[0] || 'RIT Maintenance Tracker';
    subEl.textContent = subtitle || meta[1] || '';
    pageSlot.replaceChildren(node);
    setActiveNav(path.startsWith('/complaints/') ? '/complaints' : path);
    pageSlot.scrollTo?.({ top: 0 });
    closeMobileNav();
  }

  setActiveNav(activePath);

  return { element: shell, setPage, setActiveNav };
}
