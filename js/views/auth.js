/**
 * views/auth.js
 * ---------------------------------------------------------------------------
 * The public, signed-out screens:
 *   - Login            (#/login)
 *   - Student register (#/register)
 *   - Forgot password  (#/forgot)
 *
 * Admin accounts can NOT be created here. Only the Super Admin can create admin
 * accounts, and only from inside the dashboard (see auth.js / admin-accounts.js).
 */

import { el, field, textInput, select, icon, frag } from '../ui.js';
import { registerStudent, login, sendResetEmail } from '../auth.js';
import { DEPARTMENTS, YEARS, SECTIONS } from '../constants.js';
import { checkPassword, isValidEmail, isValidRegisterNumber, friendlyAuthError } from '../utils.js';

/** Shared two-column layout: branding on the left, form card on the right. */
function authShell(cardContent) {
  const points = [
    'Report college and hostel maintenance issues in one place.',
    'Track every complaint with a unique ID and live status updates.',
    'Role-based dashboards for students, hostel, college and super admins.',
  ];

  return el(
    'div',
    { class: 'auth' },
    el(
      'aside',
      { class: 'auth__aside' },
      el(
        'div',
        {},
        el(
          'div',
          { class: 'auth__aside-logo' },
          el('img', { src: 'assets/logo.svg', alt: 'RIT logo' }),
          el('div', {},
            el('div', { class: 'sidebar__name', text: 'Rajalakshmi Institute of Technology' }),
            el('div', { class: 'sidebar__tag', text: 'Maintenance Tracker' })
          )
        ),
        el('h1', {}, 'Maintenance & Complaint Management System'),
        el('p', {}, 'A single portal for campus and hostel facility complaints — from reporting to resolution and feedback.')
      ),
      el('div', { class: 'auth__points' },
        ...points.map((text) => el('div', { class: 'auth__point' }, icon('check', 18), el('span', { text })))
      )
    ),
    el('div', { class: 'auth__panel' }, el('div', { class: 'auth__card' }, cardContent))
  );
}

function tabs(activeMode) {
  const items = [
    { mode: 'login', label: 'Sign in', href: '#/login' },
    { mode: 'register', label: 'Student register', href: '#/register' },
  ];
  return el(
    'div',
    { class: 'auth__tabs' },
    ...items.map((item) =>
      el(
        'button',
        {
          class: `auth__tab ${activeMode === item.mode ? 'is-active' : ''}`,
          type: 'button',
          onclick: () => { window.location.hash = item.href; },
        },
        item.label
      )
    )
  );
}

/* ------------------------------------------------------------------ login */

function loginView(ctx) {
  const email = textInput({ id: 'loginEmail', type: 'email', placeholder: 'you@rit.edu.in', autocomplete: 'email', required: true });
  const password = textInput({ id: 'loginPassword', type: 'password', placeholder: 'Your password', autocomplete: 'current-password', required: true });
  const submit = el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Sign in');

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    tabs('login'),
    el('h2', { style: { fontSize: '19px' } }, 'Welcome back'),
    el('p', { class: 'muted' }, 'Sign in to raise and track maintenance complaints.'),
    field({ label: 'Email address', required: true, control: email, id: 'loginEmail' }),
    field({ label: 'Password', required: true, control: password, id: 'loginPassword' }),
    el('div', { class: 'row row--between' },
      el('a', { href: '#/forgot', class: 'muted' }, 'Forgot password?'),
      el('span', { class: 'faint', text: 'Students self-register below' })
    ),
    submit,
    el('p', { class: 'auth__hint' },
      'Admin accounts are created by the Super Admin only. Students cannot select an admin role at registration.'
    )
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!email.value.trim() || !password.value) {
      ctx.toast('Please enter your email and password.', 'error');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    try {
      await login(email.value.trim(), password.value);
      ctx.toast('Signed in successfully.', 'success');
      window.location.hash = '#/dashboard';
    } catch (error) {
      ctx.toast(friendlyAuthError(error), 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
  });

  return { element: authShell(form) };
}

/* --------------------------------------------------------------- register */

function registerView(ctx) {
  const fullName = textInput({ id: 'regName', placeholder: 'Full name', autocomplete: 'name', required: true });
  const regNo = textInput({ id: 'regNo', placeholder: 'e.g. 2115010', required: true });
  const email = textInput({ id: 'regEmail', type: 'email', placeholder: 'you@rit.edu.in', autocomplete: 'email', required: true });
  const department = select({ id: 'regDept', options: DEPARTMENTS, placeholder: 'Select department', required: true });
  const year = select({ id: 'regYear', options: YEARS, placeholder: 'Select year', required: true });
  const section = select({ id: 'regSection', options: SECTIONS, placeholder: 'Select section', required: true });
  const password = textInput({ id: 'regPassword', type: 'password', placeholder: 'Minimum 8 characters', autocomplete: 'new-password', required: true });
  const confirm = textInput({ id: 'regConfirm', type: 'password', placeholder: 'Re-enter password', autocomplete: 'new-password', required: true });
  const submit = el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Create student account');

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    tabs('register'),
    el('h2', { style: { fontSize: '19px' } }, 'Student registration'),
    el('p', { class: 'muted' }, 'Create your student account to submit and track complaints.'),
    el('div', { class: 'grid-form' },
      el('div', { class: 'span-2' }, field({ label: 'Full name', required: true, control: fullName, id: 'regName' })),
      field({ label: 'Register number', required: true, control: regNo, id: 'regNo' }),
      field({ label: 'Department', required: true, control: department, id: 'regDept' }),
      field({ label: 'Year', required: true, control: year, id: 'regYear' }),
      field({ label: 'Section', required: true, control: section, id: 'regSection' })
    ),
    field({ label: 'Email address', required: true, control: email, id: 'regEmail', hint: 'Use your college email address.' }),
    el('div', { class: 'grid-form' },
      field({ label: 'Password', required: true, control: password, id: 'regPassword', hint: 'At least 8 characters with a letter and a number.' }),
      field({ label: 'Confirm password', required: true, control: confirm, id: 'regConfirm' })
    ),
    submit,
    el('p', { class: 'auth__hint' }, 'Registration always creates a STUDENT account. Admin roles are assigned only by the Super Admin.')
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = {
      fullName: fullName.value.trim(),
      regNo: regNo.value.trim(),
      email: email.value.trim(),
      department: department.value,
      year: year.value,
      section: section.value,
      password: password.value,
    };

    if (Object.values(values).some((v) => !v)) return ctx.toast('Please fill in every field.', 'error');
    if (!isValidEmail(values.email)) return ctx.toast('Please enter a valid email address.', 'error');
    if (!isValidRegisterNumber(values.regNo)) return ctx.toast('Register number looks invalid (4–20 letters, digits, - or /).', 'error');
    const strength = checkPassword(values.password);
    if (!strength.valid) return ctx.toast(`Password needs ${strength.problems.join(', ')}.`, 'error');
    if (values.password !== confirm.value) return ctx.toast('Passwords do not match.', 'error');

    submit.disabled = true;
    submit.textContent = 'Creating account…';
    try {
      await registerStudent(values);
      ctx.toast('Registration successful. Welcome to RIT Maintenance Tracker!', 'success');
      window.location.hash = '#/dashboard';
    } catch (error) {
      ctx.toast(friendlyAuthError(error), 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Create student account';
    }
  });

  return { element: authShell(form) };
}

/* -------------------------------------------------------- forgot password */

function forgotView(ctx) {
  const email = textInput({ id: 'forgotEmail', type: 'email', placeholder: 'you@rit.edu.in', autocomplete: 'email', required: true });
  const submit = el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Send reset link');

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    el('h2', { style: { fontSize: '19px' } }, 'Reset your password'),
    el('p', { class: 'muted' }, 'Enter the email you registered with and we will send a secure reset link.'),
    field({ label: 'Email address', required: true, control: email, id: 'forgotEmail' }),
    submit,
    el('div', { class: 'row' }, icon('alert', 16), el('a', { href: '#/login', class: 'muted' }, 'Back to sign in'))
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isValidEmail(email.value.trim())) return ctx.toast('Please enter a valid email address.', 'error');
    submit.disabled = true;
    try {
      await sendResetEmail(email.value.trim());
      ctx.toast('If that email exists, a reset link is on its way. Check your inbox and spam folder.', 'success', 7000);
      form.reset();
    } catch (error) {
      ctx.toast(friendlyAuthError(error), 'error');
    } finally {
      submit.disabled = false;
    }
  });

  return { element: authShell(form) };
}

/** Entry point used by app.js */
export function createAuthView(ctx, mode = 'login') {
  if (mode === 'register') return registerView(ctx);
  if (mode === 'forgot') return forgotView(ctx);
  return loginView(ctx);
}

/** Friendly screen shown when js/firebase-config.js still has placeholders. */
export function createSetupView() {
  const steps = [
    'Open the Firebase Console and create a project.',
    'Enable Authentication → Email/Password.',
    'Create a Cloud Firestore database and enable Storage.',
    'Copy your Web app config into js/firebase-config.js.',
    'Publish firestore.rules and storage.rules from this project.',
  ];
  return {
    element: authShell(
      el(
        'div',
        { class: 'stack' },
        el('h2', { style: { fontSize: '19px' } }, 'Firebase is not configured yet'),
        el('p', { class: 'muted' }, 'The app needs your Firebase project keys before it can run. Open js/firebase-config.js and paste your Web app configuration.'),
        el('ol', { style: { paddingLeft: '18px', display: 'grid', gap: '8px' } },
          ...steps.map((step) => el('li', { class: 'muted', style: { listStyle: 'decimal' }, text: step }))
        ),
        el('p', { class: 'auth__hint' }, 'Full instructions are in README.md.')
      )
    ),
  };
}
