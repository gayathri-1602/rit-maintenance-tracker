# RIT Maintenance Tracker

A single-page HTML/CSS/JavaScript maintenance portal using Firebase Authentication, Cloud Firestore, and Firebase Storage.

## Included features

- Student registration and login using Firebase Email/Password Authentication
- College complaint form: name, registration number, year, department, complaint type, description, priority, feedback, attachment
- Hostel complaint form: name, registration number, room number, hostel (RIT/RMC/IMA), complaint type, description, priority, feedback, attachment
- Complaints saved in one Firestore `complaints` collection
- Student dashboard showing only the signed-in student's complaints
- College Admin sees college complaints only
- Hostel Admin sees hostel complaints only
- Super Admin sees all complaints
- Admins can update complaint priority and status
- Optional file upload to Firebase Storage (10 MB maximum)

## 1. Create and configure Firebase

1. Open the Firebase Console: https://console.firebase.google.com/
2. Create a Firebase project.
3. Add a Web App and copy its Firebase configuration.
4. For local development, replace the placeholder values in `js/firebase-config.js` with your Firebase web app configuration.
5. Enable **Authentication → Sign-in method → Email/Password**.
6. Create a **Cloud Firestore** database.
7. Enable **Storage** and complete its setup.

## 2. Apply security rules

- Open Firestore Database → Rules and paste the contents of `firestore.rules`.
- Open Storage → Rules and paste the contents of `storage.rules`.
- Publish both rule sets.

These rules ensure public registration can create only a `student` profile. Users cannot select or grant themselves an admin role.

## 3. Create admin accounts safely

1. Register each admin account through the website first.
2. In Firebase Console → Authentication, find the account and copy its User UID.
3. Open Firestore Database → `users` collection → the document whose ID is that UID.
4. Change its `role` field from `student` to exactly one of:
   - `collegeAdmin`
   - `hostelAdmin`
   - `superAdmin`
5. Save. Sign out and sign back in as that account.

Do not add an admin role selector to public registration. Only a trusted project owner should assign admin roles in Firebase Console or through a protected server-side admin process.

## 4. Run the website

From the project directory, start a local static server:

```powershell
py -m http.server 8000
```

Then open http://localhost:8000. You can also use VS Code with the Live Server extension.

## 5. Deploy with GitHub Pages

The `Deploy to GitHub Pages` workflow publishes the project whenever code is pushed to `main`. Configure the repository's Pages source as **GitHub Actions**. The deployed site URL is:

https://gayathri-1602.github.io/rit-maintenance-tracker/

To enable Firebase on the deployed site, add these repository **Actions variables** under Settings → Secrets and variables → Actions → Variables:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

After adding or changing variables, run the workflow again. If they are not set, the published page displays the Firebase setup instructions. Add the deployed domain to Firebase Authentication's authorized domains.

## Firestore data structure

- `users/{uid}`: `{ email, role, createdAt }`
- `complaints/{autoId}`: student details, location, complaint type, description, priority, feedback, attachment metadata, status, user ID and timestamps.

## Important notes

- This is a frontend demonstration app. Firebase web configuration is not a password or secret, but Firestore and Storage Security Rules are essential.
- Never publish permissive rules such as `allow read, write: if true`.
- Admin accounts must be assigned manually as described above.
- File uploads are stored in Firebase Storage; the Firestore document stores the file name, URL and content type.
- Test with separate student, college-admin, hostel-admin and super-admin accounts.
