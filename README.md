# KwartoKeeper — Technical Manual

KwartoKeeper is a boarding-house and dormitory management system. Owners manage properties, rooms and beds, tenants, rent and fees, repairs and curfew; caretakers run the day-to-day work at a property; tenants pay rent, report repairs and read their house rules and contract. Admins approve owner accounts.

It runs as a web app, an Android app (Capacitor) and a Windows desktop app (Electron), all built from the same React code, on Firebase (Authentication and Cloud Firestore).

---

## Contents

1. [Roles and what each can do](#1-roles-and-what-each-can-do)
2. [Tech stack](#2-tech-stack)
3. [Project structure](#3-project-structure)
4. [Setting up a development copy](#4-setting-up-a-development-copy)
5. [Running, building and packaging](#5-running-building-and-packaging)
6. [Firebase setup and deployment](#6-firebase-setup-and-deployment)
7. [Background jobs (reminders and push)](#7-background-jobs-reminders-and-push)
8. [Data model](#8-data-model)
9. [Repair prioritization (AHP)](#9-repair-prioritization-ahp)
10. [Billing rules](#10-billing-rules)
11. [Security rules](#11-security-rules)
12. [Testing](#12-testing)
13. [Panel revisions (final defense)](#13-panel-revisions-final-defense)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Roles and what each can do

| Role | Signs up | Main screens | Can do |
|---|---|---|---|
| **Admin** | Created in Firebase | Overview, Owners, Announcements, Settings | Approve or suspend owners, post system announcements, turn on owner auto-approval |
| **Owner** | Self sign-up, then admin approval | Overview, Properties, Tenants, Payments, Maintenance, Caretakers, Announcements, Reports, Account | Everything for their own properties |
| **Caretaker** | Invited by an owner (temporary password) | Overview, Tenants, Repairs, Payments, Rooms, Curfew | Only what the owner allowed: manage tenants, log occupancy/curfew, handle repairs, view financials, change room layout |
| **Tenant** | Registered by an owner (email link to set a password) | Overview, Payments, Repairs, My room & rules | Pay rent (with proof), report and follow repairs, confirm fixes and rate the service, read and agree to the contract |

## 2. Tech stack

| Part | Technology |
|---|---|
| UI | React 19, Material UI 9, React Router 7, Vite 8 |
| Data and sign-in | Firebase Authentication, Cloud Firestore (`firestore.rules`, `firestore.indexes.json`) |
| Files (photos, documents, QR codes, receipts) | Cloudinary unsigned uploads (`src/utils/cloudinary.js`) |
| Android app | Capacitor 8 (`android/`, `capacitor.config.json`), push through `@capacitor-firebase/messaging` |
| Desktop app | Electron (`main-electron.js`, `npm run build:exe`) |
| PDFs | jsPDF + jspdf-autotable (reports, contracts) |
| Receipt reading (OCR) | tesseract.js, runs on the device |
| Server tasks | Firebase Cloud Functions (`functions/src`) or the free local loops (`functions/*.js`) |
| Tests | Vitest (logic), Firebase Rules Unit Testing on the Firestore emulator (security rules) |

## 3. Project structure

```
src/
  App.jsx, main.jsx         routes and app start
  config/firebase.js        Firebase app, auth and db (emulators when VITE_USE_EMULATORS=true)
  context/AuthContext.jsx   signed-in user
  layouts/                  one shell per role (Owner, Caretaker, Tenant, Admin) + AppShell
  pages/
    owner/                  owner screens (properties/, tenants/, caretakers/, Payments, Maintenance, Reports, Account...)
    caretaker/              caretaker dashboard and its tabs (caretakerParts.jsx = shared pieces)
    tenant/                 tenant dashboard and its tabs (tenantParts.jsx = shared pieces)
    admin/, auth/, onboarding/
  components/               pieces shared across roles (Fees, DepositPanel, RepairWorkflow, ContractCard...)
  services/                 notificationService (who gets told what), caretakerService, propertyService, activityLog
  utils/                    plain logic, most of it unit-tested (*.test.js next to the file)
  i18n/                     English text is the key; Filipino in fil*.js
functions/
  src/                      Cloud Functions (lease reminders, overdue, push, media cleanup)
  localPushListener.js      free alternative: sends pushes and runs the reminder loops on your computer
tests/rules/                security rules tests (run on the Firestore emulator)
scripts/                    admin scripts (sync deleted/disabled sign-in accounts)
firestore.rules, firestore.indexes.json, storage.rules, firebase.json
```

Key logic files:

| File | What it decides |
|---|---|
| `utils/maintenancePrioritization.js` | AHP weights and the priority of each repair request |
| `utils/maintenanceWorkflow.js` | Changing priority, resolution notes, tenant confirmation, reopening, ratings |
| `utils/charges.js` | Fees (incl. advance rent and security deposit) and one month's bill |
| `utils/tenantRent.js` | Due dates, overdue status, late fee, advance credit, `billForMonth` used by every screen |
| `utils/billingSettings.js` | The owner's billing rules (due day, own fee types, late fee, move-in payments) |
| `utils/paymentProof.js` | Reference number checks, duplicate references, amount checks, receipt OCR |
| `utils/bedRates.js` | Separate rates per bed |
| `utils/caretakerAssignment.js` | The owner's caretaker assignment rule (1:1, 1:many, many:1, many:many) |
| `utils/contract.js` | Rental contract template, placeholders, agreement status, PDF |

## 4. Setting up a development copy

Requirements: **Node.js 20+**, npm, Git. For the security rules tests: **Java 21+** and the **Firebase CLI** (`npm i -g firebase-tools`). For Android: Android Studio.

```bash
git clone https://github.com/mejouy/kwartokeeper.git
cd kwartokeeper
git checkout dev
npm install
```

Create a `.env` file in the project folder (never commit it):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
# optional
VITE_USE_EMULATORS=false        # true = use the local Auth/Firestore emulators
VITE_SMS_WORKER_URL=            # SMS sender for caretaker invites and curfew notices
```

The values are in Firebase Console → Project settings → Your apps → Web app.

## 5. Running, building and packaging

| Command | What it does |
|---|---|
| `npm run dev` | Development server at http://localhost:5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:rules` | Security rules tests on the Firestore emulator |
| `npm run build:exe` | Windows installer and portable app (Electron) into `dist-electron/` |

Android app:

```bash
npm run build
npx cap sync android
npx cap open android      # then Build > Generate Signed Bundle / APK in Android Studio
```

Push notifications on Android need `android/app/google-services.json` from Firebase Console.

## 6. Firebase setup and deployment

1. Create a Firebase project; turn on **Authentication → Email/Password** and **Cloud Firestore**.
2. Add a web app and copy its config into `.env` (section 4).
3. Deploy the security rules and indexes (do this again after every change to them):

   ```bash
   firebase login
   firebase use <your-project-id>
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. Make the first admin: create the user in Authentication, then in Firestore create `users/{uid}` with `role: "admin"`.
5. Cloudinary: the cloud name and unsigned upload preset are in `src/utils/cloudinary.js`.
6. Host the web app anywhere that serves static files (Firebase Hosting, Netlify, Vercel) from `dist/`.

The receipt reader (OCR) downloads its language data from the internet the first time it runs on a device, so tenants need a connection when attaching a receipt.

## 7. Background jobs (reminders and push)

Two ways to run the server-side jobs:

- **Cloud Functions** (Blaze plan): `functions/src/index.js` — scheduled lease reminders and related jobs. Deploy with `firebase deploy --only functions`.
- **Free local loops** (Spark plan): from the `functions` folder, with a service account key saved as `functions/serviceAccountKey.json` (never commit it):

  ```bash
  cd functions
  npm install
  node localPushListener.js
  ```

  It sends a push for every new notification, and runs the overdue (`overdueLoop.js`) and lease-end (`leaseReminderLoop.js`) reminders. It must keep running for pushes to go out.

`scripts/sync-auth-accounts.cjs` marks profiles whose sign-in account was deleted or disabled in the Firebase console.

## 8. Data model

All collections are in Cloud Firestore. Main fields only.

| Collection | Holds |
|---|---|
| `users/{uid}` | Everyone's profile: `role` (admin/owner/caretaker/tenant), `ownerUid`, `status`. Tenants: `propertyId`, `roomId`, `bedId`, `monthlyRent`, `rentDueDay`, lease dates, `lateFeeWaived[]`, `contractAgreement`. Caretakers: `assignedPropertyId` (working on now), `assignedPropertyIds[]`, `assignedPropertyNames`, `permissions`. Owners: `billingSettings`, `caretakerAssignmentMode`, receipt counter |
| `tenants/{uid}` | Owner-side tenant record (same fields as the tenant's profile) |
| `caretakers/{uid}` | Owner-side caretaker record |
| `properties/{id}` | `ownerUid`, address, `rooms[]` (`roomName`, `floor`, `capacity`, `monthlyRatePerBed`, `bedRates{}`), `rules[]`, `ruleFiles[]`, `curfew`, `paymentMethods{}` (each with `more[]` accounts), `contract` |
| `payments/{id}` | `tenantId`, `ownerUid`, `propertyId`, `periodMonth`, `amount`, `paymentMethod`, `paymentAccount`, `referenceNumber`, `proofUrl`, `proofCheck`, `status` (Pending/Paid/Partial/Rejected), receipt number, `bill` snapshot |
| `charges/{id}` | Fees: `tenantId`, `type` (electricity, water, …, `advance`, `deposit`, `custom-…`), `amount`, `repeat` (once/monthly), `period`, `coversPeriods[]` (advance), `depositStatus` |
| `maintenance_tickets/{id}` | `tenantUid`, `propertyId`, `title`, `category` (safety/utility/routine), `originalCategory`, `priorityChanges[]`, `status`, `followUps[]`, `remarks`, `resolutionNotes`, `resolvedBy…`, `tenantConfirmed`, `reopenCount`, `reopenReason`, `review{rating, comment, at}` |
| `occupancy_logs/{propertyId_date}` | One night's curfew sheet: `entries{tenantId: {status}}` |
| `curfew_records`, `notifications`, `announcements`, `owner_announcements`, `audit_logs`, `settings` | Curfew marks, in-app/push notices, announcements, caretaker activity, global settings |

## 9. Repair prioritization (AHP)

Repair requests are ranked with the Analytic Hierarchy Process (`src/utils/maintenancePrioritization.js`). The tenant picks a category; the category's AHP weight decides the priority tier:

| Category | Example | AHP weight | Tier |
|---|---|---|---|
| Safety | exposed wiring, broken lock | 0.733 | High |
| Utility | clogged drain, appliance issue | 0.199 | Medium |
| Routine | paint chip, cosmetic issue | 0.068 | Low |

Pairwise comparison matrix: Safety vs Utility = 5, Safety vs Routine = 8, Utility vs Routine = 4 (consistency ratio 0.081 < 0.10). Requests are sorted by tier, then by how long they have waited (oldest first).

A caretaker or owner can **change the priority** after checking a request. This changes its category, so the priority still comes from the AHP weights; the tenant's original category and every change (who, when, why) are kept on the request.

## 10. Billing rules

Owner → Account → **Billing rules**:

- **Due day** for new tenants (each tenant can have their own on their profile).
- **Your fee types**: fees you charge often, with a usual amount; they appear first in *Add a fee*.
- **Late fee**: fixed amount or % of rent, added once a month when rent is still unpaid N days after the due date. Rent sent on time is never charged, even if checked later. The owner can waive it for a month on the tenant's profile.
- **Move-in payments**: advance rent and security deposit, in months of rent, suggested in *Register tenant*.

Every screen (owner, caretaker, tenant, reports) computes a month's bill with the same function, `billForMonth` in `utils/tenantRent.js`: rent, less advance rent already paid for that month, plus that month's fees and any late fee, less what was received.

Security deposits are held while the tenant stays and settled from the tenant's profile: refunded, used for unpaid rent or fees, or kept for damages.

## 11. Security rules

`firestore.rules` decides who can read and change what. Highlights:

- Owners only see and change their own properties, tenants, caretakers, payments and fees.
- Caretakers only reach the property they are working on, and only with the permissions their owner gave them. A caretaker with several properties switches between the ones the owner assigned; they cannot add properties themselves.
- Tenants can never mark a payment as paid, change their own rent, room, due day or late-fee waivers.
- Repairs: marking a request resolved needs resolution notes. Only the tenant can confirm a fix, reopen it with a reason, or rate it (once, 1–5). Owners and caretakers cannot write the tenant's answer.

Rules tests in `tests/rules/firestore.rules.test.mjs` run the app's real reads and writes for every role, plus the attacks the rules must stop.

## 12. Testing

```bash
npm test             # unit tests: billing, late fee, advance rent, proof checks, AHP, workflows, translations...
npm run test:rules   # security rules on the Firestore emulator (needs Java 21+ and the Firebase CLI)
npm run lint
npm run build
```

## 13. Panel revisions (final defense)

System changes made after the final defense, by panel suggestion:

| Suggestion | What changed | Where |
|---|---|---|
| Edit priority in caretaker | Caretaker (and owner) can change a request's priority with a reason; logged and shown to the tenant | `components/RepairWorkflow.jsx`, `utils/maintenanceWorkflow.js` |
| Notes when resolved | Resolving needs resolution notes; the tenant sees how it was fixed | same; enforced in `firestore.rules` |
| Tenant confirms it's resolved | "Yes, it's fixed" or "Not fixed yet" (reopens with a reason) | tenant Repairs tab |
| Review of the service | 1–5 stars and a comment after confirming; average in the Maintenance report | tenant Repairs tab, Reports |
| Check finances (DP) | Advance rent and security deposit as optional move-in fees; deposit tracking | `utils/charges.js`, `components/DepositPanel.jsx`, Register tenant |
| Separate bed rates | Each bed can have its own rate | Property → room → *Set rates per bed* |
| Proof of payment validation + OCR | Reference format, repeated references, amount vs bill, and receipt reading compared with what was typed; flags for the owner | `utils/paymentProof.js`, Payments |
| More payment accounts | Several accounts per method, plus bank transfer | Payments → Payment accounts |
| Reports, individual reports | Per-tenant report (statement of account, payments, fees, repairs, curfew); repair confirmations and ratings | Reports → *Per tenant* |
| Caretaker assignment | Owner chooses 1:1 (default), 1:many, many:1 or many:many | Caretakers page |
| Contract (rules and regulations) | Owner writes a contract per property; tenants agree in the app; PDF download | Property → *Rental contract* |
| Editable singilan | Due day per tenant, own fee types with usual amounts, automatic late fee | Account → *Billing rules* |
| Technical manual | This README | `README.md` |

## 14. Troubleshooting

| Problem | Fix |
|---|---|
| "Missing or insufficient permissions" after an update | Deploy the latest rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes`, and update the app on phones (rebuild the APK). |
| A caretaker with several properties isn't notified for one of them | The `users (role, assignedPropertyIds)` index is still building or wasn't deployed. |
| Receipt "couldn't be read" | The device was offline the first time, or the image is blurry. The payment still goes through; the owner checks it by eye. |
| No push notifications | `localPushListener.js` isn't running (free plan), or `google-services.json` is missing from the Android build. |
| Rules tests won't start | Install Java 21+ and the Firebase CLI, then `npm run test:rules`. |
