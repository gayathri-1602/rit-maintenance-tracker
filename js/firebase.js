/**
 * firebase.js
 * ---------------------------------------------------------------------------
 * Initialises Firebase ONCE and re-exports only the SDK functions the app uses.
 * Every other module imports Firebase from here, so there is a single place
 * that knows about the Firebase version (10.12.2, ES-module build from CDN -
 * no npm install required).
 */

import { initializeApp, getApps, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
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
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import { firebaseConfig } from './firebase-config.js';

/** The primary Firebase app used for the logged-in session. */
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Creates a SECOND, temporary Firebase app.
 * We need this so a Super Admin can create another user's login without being
 * signed out of their own session (creating a user signs in the *creating* app).
 * The caller must call `disposeSecondaryApp()` when finished.
 */
export function createSecondaryApp(name) {
  return initializeApp(firebaseConfig, name);
}
export async function disposeSecondaryApp(secondaryApp) {
  try {
    await signOut(getAuth(secondaryApp));
  } catch {
    /* ignore - user may never have been created */
  }
  await deleteApp(secondaryApp);
}

export {
  // auth
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
  // firestore
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getCountFromServer,
  // storage
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
};
