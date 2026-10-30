/**
 * app.js
 * ---------------------------------------------------------------------------
 * Application entry point (loaded by index.html as a module).
 *
 * Responsibilities:
 *   1. Show a friendly setup screen if js/firebase-config.js is not filled in.
 *   2. Watch the Firebase session and keep the user's profile (role) in memory.
 *   3. Route between the signed-out screens and each role's dashboard.
 *   4. Enforce role-based access to pages (defence in depth - the real
 *      enforcement is in firestore.rules / storage.rules).
 */

import { isFirebaseConfigured } from './firebase-config.js';
import { watchAuth } from './auth.js';
import { addRoute, resolveRoute, startRouter, currentPath, replace } from './router.js';
import { toast } from './ui.js';
import { ROLES } from './constants.js';

import { createAuthView, createSetupView } from './views/auth.js';
import { createShell } from './views/shell.js';
import { createOverview } from './views/overview.js';
import { createComplaintForm } from './views/complaint-form.js';
import { createComplaintList } from './views/complaint-list.js';
import { createComplaintDetail } from './views/complaint-detail.js';
import { createProfile } from './views/profile.js';
import { createAdminAccounts } from './views/admin-accounts.js';
import { createCategoriesManager } from './views/categories.js';
import { createFeedbackView } from './views/feedback.js';

const ALL_ROLES = [ROLES.STUDENT, ROLES.COLLEGE_ADMIN, ROLES.HOSTEL_ADMIN, ROLES.SUPER_ADMIN];
const ADMIN_ROLES = [ROLES.COLLEGE_ADMIN, ROLES.HOSTEL_ADMIN, ROLES.SUPER_ADMIN];

const appRoot = document.getElementById('app');
const bootEl = document.getElementById('boot');
const bootText = document.getElementById('bootText');

/* ------------------------------------------------------------------ state */

const state = {
  profile: null,
  shell: null,
  view: null,
  routerStarted: false,
};

/**
 * The context object handed to every view.
 * `profile` is a live getter so views always see the current user.
 */
const ctx = {
  get profile() {
    return state.profile;
  },
  toast,
  /** Rebuilds the chrome (sidebar/topbar) and the current page, e.g. after a profile edit. */
  refreshChrome() {
    state.shell = null;
    handleNavigation(currentPath());
  },
};

/* ----------------------------------------------------------------- routes */

const ROUTES = [
  { path: '/dashboard', roles: ALL_ROLES, title: 'Dashboard', subtitle: 'Overview of maintenance activity', build: (c) => createOverview(c) },
  { path: '/new', roles: [ROLES.STUDENT], title: 'Submit a complaint', subtitle: 'Report a college or hostel maintenance issue', build: (c) => createComplaintForm(c) },
  { path: '/complaints', roles: ALL_ROLES, build: (c) => createComplaintList(c, listOptions(c)) },
  { path: '/complaints/:id', roles: ALL_ROLES, title: 'Complaint details', subtitle: 'Full record, history and attachments', build: (c, params) => createComplaintDetail(c, params.id) },
  { path: '/students', roles: [ROLES.SUPER_ADMIN], title: 'Registered students', subtitle: 'Every student account in the system', build: (c) => createAdminAccounts(c, { initialTab: 'students' }) },
  { path: '/admins', roles: [ROLES.SUPER_ADMIN], title: 'Admin accounts', subtitle: 'Create and manage admin access', build: (c) => createAdminAccounts(c, { initialTab: 'admins' }) },
  { path: '/categories', roles: [ROLES.SUPER_ADMIN], title: 'Complaint categories', subtitle: 'Control the options students can pick', build: (c) => createCategoriesManager(c) },
  { path: '/feedback', roles: ADMIN_ROLES, title: 'Student feedback', subtitle: 'Ratings and comments after resolution', build: (c) => createFeedbackView(c) },
  { path: '/profile', roles: ALL_ROLES, title: 'My profile', subtitle: 'Your account information and password', build: (c) => createProfile(c) },
];

/** Per-role options for the shared complaint list. */
function listOptions(c) {
  const role = c.profile.role;
  if (role === ROLES.STUDENT) {
    return {
      mode: 'student',
      title: 'My complaints',
      subtitle: 'Search by complaint ID, filter by status and track progress',
    };
  }
  if (role === ROLES.COLLEGE_ADMIN) {
    return {
      mode: 'admin',
      title: 'College complaints',
      subtitle: 'Campus maintenance requests assigned to the college team',
    };
  }
  if (role === ROLES.HOSTEL_ADMIN) {
    return {
      mode: 'admin',
      title: 'Hostel complaints',
      subtitle: `Requests from ${c.profile.hostelName || 'your hostel'}`,
    };
  }
  return {
    mode: 'admin',
    title: 'All complaints',
    subtitle: 'Every college and hostel complaint in the system',
    showHostelFilter: true,
    showTypeFilter: true,
    showExport: true,
  };
}

ROUTES.forEach((route) => {
  addRoute(route.path, (params) => renderRoute(route, params));
});

/* ------------------------------------------------------------- rendering */

function destroyView() {
  if (state.view && typeof state.view.destroy === 'function') {
    try {
      state.view.destroy();
    } catch (error) {
      console.warn('View cleanup failed:', error);
    }
  }
  state.view = null;
}

function showBoot(text) {
  if (bootText) bootText.textContent = text;
  bootEl.hidden = false;
}

function hideBoot() {
  bootEl.hidden = true;
  appRoot.hidden = false;
}

/** Signed-out screens: login, register, forgot password. */
function renderSignedOut(path) {
  destroyView();
  state.shell = null;
  const allowed = ['/login', '/register', '/forgot'];
  const target = allowed.includes(path) ? path : '/login';
  if (target !== path) replace(target);

  const mode = target === '/register' ? 'register' : target === '/forgot' ? 'forgot' : 'login';
  const view = createAuthView(ctx, mode);
  state.view = view;
  appRoot.replaceChildren(view.element);
  hideBoot();
}

/** Signed-in screens: the shell plus the routed page. */
function renderRoute(route, params) {
  const role = state.profile.role;

  if (!route.roles.includes(role)) {
    toast('You do not have access to that page.', 'error');
    const fallback = ROUTES.find((r) => r.path === '/dashboard');
    replace('/dashboard');
    return renderRoute(fallback, {});
  }

  destroyView();

  if (!state.shell) state.shell = createShell(ctx);

  const view = route.build(ctx, params);
  state.view = view;

  if (appRoot.firstChild !== state.shell.element) {
    appRoot.replaceChildren(state.shell.element);
  }
  state.shell.setPage({
    path: route.path,
    title: route.title,
    subtitle: route.subtitle,
    node: view.element,
  });
  hideBoot();
}

/** Central navigation handler used by the hash router. */
function handleNavigation(path) {
  const target = path === '/' ? '/dashboard' : path;
  if (!state.profile) {
    renderSignedOut(target);
    return;
  }
  const resolved = resolveRoute(target);
  if (!resolved) {
    replace('/dashboard');
    renderRoute(ROUTES.find((r) => r.path === '/dashboard'), {});
    return;
  }
  resolved.handler(resolved.params);
}

/* ---------------------------------------------------------------- startup */

function start() {
  if (!isFirebaseConfigured()) {
    // Firebase keys are still placeholders - show setup instructions instead of
    // a wall of console errors.
    const view = createSetupView();
    appRoot.replaceChildren(view.element);
    hideBoot();
    return;
  }

  watchAuth(({ profile, reason, error }) => {
    if (reason === 'deactivated') toast('Your account has been deactivated. Please contact the administrator.', 'error', 8000);
    if (reason === 'no-profile') toast('No profile was found for this account. Please contact the administrator.', 'error', 8000);
    if (error) toast(error.message || 'Could not load your profile.', 'error', 8000);

    state.profile = profile;
    state.shell = null;
    destroyView();

    if (!state.routerStarted) {
      state.routerStarted = true;
      startRouter(handleNavigation);
    } else {
      handleNavigation(currentPath());
    }
  });
}

start();
