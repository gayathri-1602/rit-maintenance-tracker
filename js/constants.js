/**
 * constants.js
 * ---------------------------------------------------------------------------
 * Single source of truth for all fixed values (roles, statuses, priorities,
 * dropdown lists, limits). Keeping them here guarantees every screen shows the
 * same lists - no duplicated literals scattered through the code.
 */

/** Firestore `role` values. These strings must match firestore.rules exactly. */
export const ROLES = {
  STUDENT: 'student',
  COLLEGE_ADMIN: 'collegeAdmin',
  HOSTEL_ADMIN: 'hostelAdmin',
  SUPER_ADMIN: 'superAdmin',
};

export const ROLE_LABELS = {
  [ROLES.STUDENT]: 'Student',
  [ROLES.COLLEGE_ADMIN]: 'College Admin',
  [ROLES.HOSTEL_ADMIN]: 'Hostel Admin',
  [ROLES.SUPER_ADMIN]: 'Super Admin',
};

/** Which complaint bucket a complaint belongs to. */
export const COMPLAINT_TYPE = {
  COLLEGE: 'College',
  HOSTEL: 'Hostel',
};

/** Priority levels and the CSS class used for their colour chip. */
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const PRIORITY_CLASS = {
  Low: 'chip--low',
  Medium: 'chip--medium',
  High: 'chip--high',
};

/**
 * Complaint lifecycle.
 *   Submitted  - just created by a student (waiting for an admin to open it)
 *   Pending    - acknowledged but not started
 *   In Progress- an admin is working on it
 *   Resolved   - fixed and closed (student can now give feedback)
 *   Rejected   - not a valid/maintainable request
 */
export const STATUSES = ['Submitted', 'Pending', 'In Progress', 'Resolved', 'Rejected'];
export const STATUS_CLASS = {
  Submitted: 'chip--submitted',
  Pending: 'chip--pending',
  'In Progress': 'chip--progress',
  Resolved: 'chip--resolved',
  Rejected: 'chip--rejected',
};

/** Default complaint categories. Super Admin can override these in Firestore. */
export const DEFAULT_CATEGORIES = {
  College: [
    'Electrical',
    'Plumbing',
    'Furniture',
    'Classroom Maintenance',
    'Laboratory Equipment',
    'Internet / Wi-Fi',
    'Cleanliness',
    'Other',
  ],
  Hostel: [
    'Electrical',
    'Plumbing',
    'Bathroom',
    'Water Supply',
    'Furniture',
    'Room Maintenance',
    'Cleanliness',
    'Internet',
    'Other',
  ],
};

/** Static dropdown options. */
export const HOSTELS = ['RIT Hostel', 'RMC Hostel', 'IMA Hostel'];
export const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML', 'MBA', 'Other'];
export const YEARS = ['I Year', 'II Year', 'III Year', 'IV Year'];
export const SECTIONS = ['A', 'B', 'C', 'D'];

/** Upload constraints (also enforced server-side by storage.rules). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_FILE_PREFIXES = ['image/', 'video/'];
export const ALLOWED_FILE_TYPES = ['application/pdf'];

/** Firestore collection names - avoids typos across modules. */
export const COLLECTIONS = {
  USERS: 'users',
  COMPLAINTS: 'complaints',
  UPDATES: 'updates',
  CATEGORIES: 'categories',
};
