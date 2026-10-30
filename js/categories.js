/**
 * categories.js
 * ---------------------------------------------------------------------------
 * Complaint categories are stored in Firestore so the Super Admin can add,
 * rename or retire them without touching code. The built-in defaults in
 * constants.js always remain available, so the app still works on day one with
 * an empty database.
 */

import { db, collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from './firebase.js';
import { COLLECTIONS, DEFAULT_CATEGORIES } from './constants.js';

/** Stable document id so toggling a default category is an upsert, not a dupe. */
export function categoryDocId(type, name) {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${String(type).toLowerCase()}_${slug}`;
}

/**
 * Combines the defaults with whatever is in Firestore.
 * A category that exists in Firestore with `active: false` is hidden.
 */
export function mergeCategories(custom = []) {
  const result = { College: [], Hostel: [] };
  for (const type of ['College', 'Hostel']) {
    const forType = custom.filter((c) => c.type === type);
    const disabled = new Set(forType.filter((c) => c.active === false).map((c) => c.name));
    const extras = forType.filter((c) => c.active !== false).map((c) => c.name);
    result[type] = [...new Set([...DEFAULT_CATEGORIES[type], ...extras])].filter((name) => !disabled.has(name));
  }
  return result;
}

/** Live category lists. Calls `onData({ College: [...], Hostel: [...] })`. */
export function subscribeCategories(onData, onError) {
  return onSnapshot(
    collection(db, COLLECTIONS.CATEGORIES),
    (snapshot) => onData(mergeCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => { if (onError) onError(error); }
  );
}

/** Live raw list (includes disabled entries) - used by the manager screen. */
export function subscribeRawCategories(onData, onError) {
  return onSnapshot(
    collection(db, COLLECTIONS.CATEGORIES),
    (snapshot) => onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => { if (onError) onError(error); }
  );
}

/** Super Admin: add a new category. */
export async function addCategory(type, name) {
  const clean = String(name).trim();
  if (!clean) throw new Error('Please enter a category name.');
  const id = categoryDocId(type, clean);
  await setDoc(
    doc(db, COLLECTIONS.CATEGORIES, id),
    { type, name: clean, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  );
  return id;
}

/** Super Admin: enable / disable a category (works for defaults too). */
export async function setCategoryActive(type, name, active) {
  const id = categoryDocId(type, name);
  await setDoc(doc(db, COLLECTIONS.CATEGORIES, id), { type, name, active: Boolean(active), updatedAt: serverTimestamp() }, { merge: true });
}

/** Super Admin: permanently remove a custom category entry. */
export async function deleteCategory(id) {
  await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, id));
}
