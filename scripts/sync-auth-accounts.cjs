#!/usr/bin/env node
/*
 * Marks Firestore profiles whose Firebase Authentication account was deleted or
 * disabled, so the app stops showing them (and un-marks them if re-enabled).
 *
 * Why: deleting or disabling a user in the Firebase console only touches their
 * sign-in account. Their profile in users / tenants / caretakers stays, so they'd
 * keep appearing in lists and counts. The app can't read the Authentication list
 * from the browser, so this runs on your computer with an admin key. It's free
 * on the Spark plan (no Cloud Functions needed).
 *
 * Setup (once):
 *   1. Firebase console → Project settings → Service accounts → Generate new private key.
 *      Save the JSON somewhere safe OUTSIDE this repo, and never commit it.
 *   2. cd functions && npm install      (provides firebase-admin)
 *
 * Run from the project root:
 *   node scripts/sync-auth-accounts.cjs --key C:\path\to\key.json            (preview, changes nothing)
 *   node scripts/sync-auth-accounts.cjs --key C:\path\to\key.json --apply    (writes the changes)
 *
 * What it writes on a profile whose account is gone:
 *   accountRemoved: "deleted" | "disabled", accountRemovedAt, previousStatus
 *   tenants & caretakers → status "Inactive"; owners → status "suspended"
 * When the account is re-enabled, the flag is removed and the old status restored.
 */

const path = require("path");
const admin = require(path.join(__dirname, "..", "functions", "node_modules", "firebase-admin"));

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const keyIdx = args.indexOf("--key");
const keyPath = keyIdx >= 0 ? args[keyIdx + 1] : process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!keyPath) {
  console.error("Missing the service-account key. Use --key <path-to-key.json> (see the notes at the top of this file).");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyPath))) });
const auth = admin.auth();
const db = admin.firestore();

async function listAllAuthUsers() {
  const users = new Map();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    page.users.forEach((u) => users.set(u.uid, { disabled: u.disabled, email: u.email || "" }));
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

const statusWhenRemoved = (collection, data) => {
  const role = String(data.role || (collection === "tenants" ? "tenant" : collection === "caretakers" ? "caretaker" : "")).toLowerCase();
  if (role === "owner") return { status: "suspended", suspendedAt: new Date().toISOString() };
  if (role === "tenant" || role === "caretaker") return { status: "Inactive" };
  return {};
};

async function main() {
  console.log(apply ? "APPLYING changes…\n" : "Preview only (add --apply to write).\n");
  const authUsers = await listAllAuthUsers();
  console.log(`Sign-in accounts in Firebase Authentication: ${authUsers.size}`);

  const changes = [];
  for (const collection of ["users", "tenants", "caretakers"]) {
    const snap = await db.collection(collection).get();
    snap.forEach((doc) => {
      const data = doc.data();
      if (String(data.role || "").toLowerCase() === "admin") return; // never lock out an admin from here
      const uid = data.uid || doc.id;
      const account = authUsers.get(uid);
      const state = !account ? "deleted" : account.disabled ? "disabled" : null;
      const label = `${collection}/${doc.id}  ${data.fullName || data.name || data.email || ""}`.trim();

      if (state && data.accountRemoved !== state) {
        changes.push({
          label: `${label}  → mark ${state}`,
          ref: doc.ref,
          patch: {
            accountRemoved: state,
            accountRemovedAt: new Date().toISOString(),
            ...(data.accountRemoved ? {} : { previousStatus: data.status ?? null }),
            ...statusWhenRemoved(collection, data),
          },
        });
      } else if (!state && data.accountRemoved) {
        const restore = data.previousStatus !== undefined ? { status: data.previousStatus ?? admin.firestore.FieldValue.delete() } : {};
        changes.push({
          label: `${label}  → account is back, un-mark`,
          ref: doc.ref,
          patch: {
            accountRemoved: admin.firestore.FieldValue.delete(),
            accountRemovedAt: admin.firestore.FieldValue.delete(),
            previousStatus: admin.firestore.FieldValue.delete(),
            ...(String(data.role || "").toLowerCase() === "owner" ? { suspendedAt: admin.firestore.FieldValue.delete() } : {}),
            ...restore,
          },
        });
      }
    });
  }

  if (!changes.length) {
    console.log("\nEverything is in sync. Nothing to change.");
    return;
  }
  console.log(`\n${changes.length} profile(s) to update:`);
  changes.forEach((c) => console.log("  " + c.label));

  if (!apply) {
    console.log("\nPreview only. Check the list above, then run again with --apply.");
    return;
  }
  for (let i = 0; i < changes.length; i += 400) {
    const batch = db.batch();
    changes.slice(i, i + 400).forEach((c) => batch.update(c.ref, c.patch));
    await batch.commit();
  }
  console.log(`\nDone. Updated ${changes.length} profile(s).`);
}

main().catch((err) => {
  console.error("Sync failed:", err.message || err);
  process.exit(1);
});
