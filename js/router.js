/**
 * router.js
 * ---------------------------------------------------------------------------
 * A very small hash-based router (#/dashboard, #/complaints/RIT-4F9A2C…).
 *
 * Hash routing was chosen on purpose:
 *   - it works with any static host / Live Server, with zero configuration;
 *   - refreshing the page keeps you on the same screen;
 *   - the browser Back button behaves normally.
 */

const routes = [];

/**
 * Registers a route. Patterns may contain parameters, e.g. '/complaints/:id'.
 * The handler receives ({ params, path }).
 */
export function addRoute(pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\/$/, '')
        .replace(/:[^/]+/g, (match) => {
          keys.push(match.slice(1));
          return '([^/]+)';
        }) +
      '/?$'
  );
  routes.push({ regex, keys, handler });
  return routes.length - 1;
}

/** Finds the handler for a path, or null. */
export function resolveRoute(path) {
  const clean = path.replace(/\/$/, '') || '/';
  for (const route of routes) {
    const match = clean.match(route.regex);
    if (match) {
      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });
      return { handler: route.handler, params, path: clean };
    }
  }
  return null;
}

/** Current path from the URL hash (defaults to '/'). */
export function currentPath() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

/** Programmatic navigation. */
export function navigate(path) {
  if (currentPath() === path) return;
  window.location.hash = path;
}

/** Replaces the current entry (used right after login/logout). */
export function replace(path) {
  window.history.replaceState(null, '', `#${path}`);
}

/**
 * Starts listening for hash changes. `onNavigate(path)` is called immediately
 * with the current path and then on every change.
 * Returns a function that stops listening.
 */
export function startRouter(onNavigate) {
  const handle = () => onNavigate(currentPath());
  window.addEventListener('hashchange', handle);
  handle();
  return () => window.removeEventListener('hashchange', handle);
}
