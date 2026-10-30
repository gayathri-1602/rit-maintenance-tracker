/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Everything related to identity:
 *   - student self-registration
 *   - login / logout / password reset
 *   - reading the user's profile (which holds their ROLE)
 *   - Super Admin creating admin accounts (via a temporary secondary app)
 *
 * SECURITY NOTE: the role is ALWAYS read from the `users/{uid}` document in
 * Firestore - never from the browser's memory - and it is the server-side
 * Security Rules (firestore.rules) that ultimately decide what each role may
 * do. Nothing here can "grant" a role by simply sending a value to the server.
 */

import {
  auth,
  db,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  createSecondaryApp,
  disposeSecondaryApp,
} from './firebase.js';
import { COLLECTIONS, ROLES } from './constants.js';

/** Fields that make up a student profile. */
function studentProfile({ email, fullName, regNo, department, year, section }) {
  return {
    email,
    role: ROLES.STUDENT, // hard-coded: students can NEVER choose a role
    fullName,
    regNo,
    department,
    year,
    section,
    hostelName: null,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Registers a new student.
 * 1. Creates the Firebase Authentication account.
 * 2. Writes the matching `users/{uid}` profile with role = "student".
 * If step 2 fails we delete the just-created auth account so the email is not
 * left in a half-registered state.
 */
export async function registerStudent({ email, password, fullName, regNo, department, year, section }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = credential;
  try {
    await updateProfile(user, { displayName: fullName });
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), studentProfile({ email, fullName, regNo, department, year, section }));
  } catch (error) {
    try {
      await deleteUser(user);
    } catch {
      /* best-effort cleanup */
    }
    throw error;
  }
  return user;
}

/**
 * Signs a user in and immediately verifies their profile exists and is active.
 * Deactivated accounts are signed straight back out.
 */
export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const snapshot = await getDoc(doc(db, COLLECTIONS.USERS, credential.user.uid));
  if (!snapshot.exists()) {
    await signOut(auth);
    throw new Error('No profile was found for this account. Please contact the administrator.');
  }
  if (snapshot.data().active === false) {
    await signOut(auth);
    throw new Error('This account has been deactivated. Please contact the administrator.');
  }
  return credential.user;
}

export function logout() {
  return signOut(auth);
}

export function sendResetEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

/** Reads a single user profile document. */
export async function getProfile(uid) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snapshot.exists() ? { uid, ...snapshot.data() } : null;
}

/**
 * Watches the Firebase session and keeps the profile in sync.
 * `handler` receives { user, profile } (both null when signed out) or
 * { user: null, reason } when the session had to be force-ended.
 */
export function watchAuth(handler) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      handler({ user: null, profile: null });
      return;
    }
    try {
      const profile = await getProfile(user.uid);
      if (!profile) {
        await signOut(auth);
        handler({ user: null, profile: null, reason: 'no-profile' });
        return;
      }
      if (profile.active === false) {
        await signOut(auth);
        handler({ user: null, profile: null, reason: 'deactivated' });
        return;
      }
      handler({ user, profile });
    } catch (error) {
      handler({ user: null, profile: null, error });
    }
  });
}

/** Updates the editable part of a user's own profile. */
export async function updateOwnProfile(uid, fields) {
  const allowed = ['fullName', 'regNo', 'department', 'year', 'section'];
  const payload = {};
  for (const key of allowed) if (key in fields) payload[key] = fields[key];
  payload.updatedAt = serverTimestamp();

  await updateDoc(doc(db, COLLECTIONS.USERS, uid), payload);
  if (fields.fullName) {
    try {
      await updateProfile(auth.currentUser, { displayName: fields.fullName });
    } catch {
      /* display name is cosmetic - ignore */
    }
  }
}

/** Changes the password after re-authenticating with the current one. */
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/**
 * Super Admin action: create a College / Hostel / Super admin account.
 *
 * Why a secondary app? `createUserWithEmailAndPassword` signs the *current*
 * browser session into the new user. By creating the account on a throwaway
 * Firebase app instance we keep the Super Admin signed in, then we discard the
 * temporary app.
 *
 * Firestore rules allow this because the caller is still a Super Admin, and the
 * check happens server-side using the Super Admin's own verified role.
 */
export async function createAdminAccount({ email, password, fullName, role, hostelName = null }) {
  const secondaryApp = createSecondaryApp(`admin-creator-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const { user } = credential;
    await updateProfile(user, { displayName: fullName });
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      email,
      role, // set explicitly by the Super Admin, verified server-side
      fullName,
      regNo: '',
      department: '',
      year: '',
      section: '',
      hostelName: role === ROLES.HOSTEL_ADMIN ? hostelName : null,
      active: true,
      createdBy: auth.currentUser ? auth.currentUser.uid : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return user.uid;
  } finally {
    await disposeSecondaryApp(secondaryApp);
  }
}

/** Super Admin action: change an existing account's role / hostel scope. */
export async function updateUserRole(uid, { role, hostelName = null }) {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    role,
    hostelName: role === ROLES.HOSTEL_ADMIN ? hostelName : null,
    updatedAt: serverTimestamp(),
  });
}

/** Super Admin action: activate or deactivate an account. */
export async function setUserActive(uid, active) {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), { active: Boolean(active), updatedAt: serverTimestamp() });
}

/** Live list of every user (Super Admin only - enforced by rules). */
export function subscribeAllUsers(onData, onError) {
  return onSnapshot(
    collection(db, COLLECTIONS.USERS),
    (snapshot) => onData(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    onError
  );
}
