/**
 * complaints.js
 * ---------------------------------------------------------------------------
 * All complaint-related data access:
 *   - uploading attachments to Firebase Storage (with progress)
 *   - creating complaints with a unique, human-friendly complaint ID
 *   - live subscriptions scoped to the signed-in user's role
 *   - admin workflow updates (status / priority / remarks) + history log
 *   - student feedback after resolution
 *
 * Every query here is deliberately shaped to match `firestore.rules`, because
 * Firestore rejects a list query unless the rules can prove that every returned
 * document is readable by the caller.
 */

import {
  db,
  storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from './firebase.js';
import { COLLECTIONS, COMPLAINT_TYPE, ROLES } from './constants.js';
import { validateAttachment, attachmentKind } from './utils.js';
import { MAX_FILE_SIZE, ALLOWED_FILE_PREFIXES, ALLOWED_FILE_TYPES } from './constants.js';

/* ----------------------------------------------------------- attachments */

/** Replaces characters that are unsafe in a Storage path. */
function safeFileName(name = 'file') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/**
 * Uploads one attachment and resolves with its metadata.
 * `onProgress` receives a 0-100 number so the UI can show a progress bar.
 */
export function uploadAttachment(file, uid, onProgress) {
  const check = validateAttachment(file, {
    maxBytes: MAX_FILE_SIZE,
    allowedPrefixes: ALLOWED_FILE_PREFIXES,
    allowedTypes: ALLOWED_FILE_TYPES,
  });
  if (!check.ok) return Promise.reject(new Error(check.reason));

  const path = `complaints/${uid}/${Date.now()}_${safeFileName(file.name)}`;
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || 'application/octet-stream' });
    task.on(
      'state_changed',
      (snapshot) => {
        if (typeof onProgress === 'function') {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({
          name: file.name,
          url,
          path,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          kind: attachmentKind(file.type || ''),
        });
      }
    );
  });
}

/** Super Admin can remove a stored file when a complaint is deleted. */
export async function deleteAttachment(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* file may already be gone - not worth failing the caller */
  }
}

/* ------------------------------------------------------------ complaints */

/**
 * Creates a complaint.
 * The Firestore document ID becomes the complaint ID, and we store a short
 * uppercase code (RIT-XXXXXXXX) that students can read, share and search by.
 */
export async function submitComplaint(profile, payload, file, onProgress) {
  let attachment = null;
  if (file) {
    attachment = await uploadAttachment(file, profile.uid, onProgress);
  }

  const ref0 = doc(collection(db, COLLECTIONS.COMPLAINTS));
  const complaintCode = `RIT-${ref0.id.slice(0, 8).toUpperCase()}`;

  await setDoc(ref0, {
    complaintCode,
    studentId: profile.uid,
    studentEmail: profile.email || '',
    status: 'Submitted',
    assignedAdminId: null,
    assignedAdminName: null,
    adminRemarks: '',
    feedback: null,
    attachment,
    resolvedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...payload, // complaintType, category, description, priority, location fields…
  });

  return { id: ref0.id, complaintCode };
}

/**
 * Builds the correct Firestore query for the signed-in role.
 * Students see their own complaints; College Admins see college complaints;
 * Hostel Admins see only their own hostel; Super Admin sees everything.
 */
export function buildComplaintQuery(profile) {
  const base = collection(db, COLLECTIONS.COMPLAINTS);
  switch (profile?.role) {
    case ROLES.STUDENT:
      return query(base, where('studentId', '==', profile.uid));
    case ROLES.COLLEGE_ADMIN:
      return query(base, where('complaintType', '==', COMPLAINT_TYPE.COLLEGE));
    case ROLES.HOSTEL_ADMIN:
      return query(base, where('complaintType', '==', COMPLAINT_TYPE.HOSTEL), where('hostelName', '==', profile.hostelName));
    case ROLES.SUPER_ADMIN:
      return query(base);
    default:
      return null;
  }
}

/** Live subscription to the complaints this user is allowed to see. */
export function subscribeComplaints(profile, onData, onError) {
  const q = buildComplaintQuery(profile);
  if (!q) {
    if (onError) onError(new Error('This role cannot view complaints.'));
    return () => {};
  }
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => { if (onError) onError(error); }
  );
}

/** Live subscription to a single complaint (used by the detail page). */
export function subscribeComplaint(complaintId, onData, onError) {
  return onSnapshot(
    doc(db, COLLECTIONS.COMPLAINTS, complaintId),
    (snapshot) => onData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    (error) => { if (onError) onError(error); }
  );
}

/** Reads the history log (status/priority/remark entries) for a complaint. */
export function subscribeComplaintUpdates(complaintId, onData, onError) {
  const updatesRef = collection(db, COLLECTIONS.COMPLAINTS, complaintId, COLLECTIONS.UPDATES);
  return onSnapshot(
    updatesRef,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.at?.toMillis?.() || 0) - (b.at?.toMillis?.() || 0));
      onData(rows);
    },
    (error) => { if (onError) onError(error); }
  );
}

/**
 * Applies an admin workflow change and writes a matching history entry.
 *   complaint - the current complaint object (needed to detect real changes)
 *   changes   - { status?, priority?, remark? }
 *   profile   - the signed-in admin (used for the audit trail)
 */
export async function applyAdminUpdate(complaint, changes, profile) {
  const { status, priority, remark } = changes;
  const nextStatus = status && status !== complaint.status ? status : null;
  const nextPriority = priority && priority !== complaint.priority ? priority : null;

  const payload = {
    updatedAt: serverTimestamp(),
    assignedAdminId: profile.uid,
    assignedAdminName: profile.fullName || profile.email || '',
  };
  if (nextStatus) payload.status = nextStatus;
  if (nextPriority) payload.priority = nextPriority;
  if (remark) payload.adminRemarks = remark;
  if (nextStatus === 'Resolved') payload.resolvedAt = serverTimestamp();

  await updateDoc(doc(db, COLLECTIONS.COMPLAINTS, complaint.id), payload);

  await addDoc(collection(db, COLLECTIONS.COMPLAINTS, complaint.id, COLLECTIONS.UPDATES), {
    status: nextStatus || complaint.status,
    priority: nextPriority || complaint.priority,
    remark: remark || '',
    byId: profile.uid,
    byName: profile.fullName || profile.email || '',
    byRole: profile.role,
    at: serverTimestamp(),
  });
}

/** Student feedback (1-5 stars + comment) once the complaint is resolved. */
export async function submitFeedback(complaintId, { rating, comment }, profile) {
  await updateDoc(doc(db, COLLECTIONS.COMPLAINTS, complaintId), {
    feedback: {
      rating: Number(rating),
      comment: comment || '',
      byId: profile.uid,
      byName: profile.fullName || profile.email || '',
      createdAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------------------------------------- analytics */

/** Counts complaints per status, used by every dashboard's stat cards. */
export function summarise(list) {
  return list.reduce(
    (acc, c) => {
      acc.total += 1;
      if (c.status === 'Submitted') acc.submitted += 1;
      if (c.status === 'Pending') acc.pending += 1;
      if (c.status === 'In Progress') acc.inProgress += 1;
      if (c.status === 'Resolved') acc.resolved += 1;
      if (c.status === 'Rejected') acc.rejected += 1;
      if (c.priority === 'High' && c.status !== 'Resolved' && c.status !== 'Rejected') acc.highOpen += 1;
      if (!c.feedback && c.status === 'Resolved') acc.awaitingFeedback += 1;
      if (c.feedback?.rating) {
        acc.ratingSum += c.feedback.rating;
        acc.ratingCount += 1;
      }
      return acc;
    },
    {
      total: 0, submitted: 0, pending: 0, inProgress: 0, resolved: 0, rejected: 0,
      highOpen: 0, awaitingFeedback: 0, ratingSum: 0, ratingCount: 0,
    }
  );
}

/** Average feedback rating (0 when there is none yet). */
export function averageRating(summary) {
  return summary.ratingCount ? summary.ratingSum / summary.ratingCount : 0;
}
