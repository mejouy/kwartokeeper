// NOT DEPLOYED: Cloud Functions need the paid Blaze plan, and the project stays on
// the free Spark plan. The app uses an emailed reset link instead (see
// emailCaretakerResetLink in src/services/caretakerService.js). Kept, with its tests,
// in case the plan changes later.
//
// Lets an owner give one of their caretakers a NEW temporary password.
//
// The first temporary password is shown once and never stored, so it can't be
// "re-sent". Instead the owner asks for a fresh one: this callable checks the
// caller really is that caretaker's owner, sets the new password with the Admin
// SDK (the browser SDK can't change someone else's password), signs the
// caretaker out everywhere, and flags the account so they must pick their own
// password on their next sign-in. The new password is returned to the owner's
// screen only; it is never saved.

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { canResetCaretakerPassword, newTempPassword } = require("./caretakerPasswordRules.js");

exports.resetCaretakerPassword = onCall({ region: "asia-southeast1" }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Please sign in again.");

  const caretakerId = String(request.data?.caretakerId || "").trim();
  if (!caretakerId) throw new HttpsError("invalid-argument", "Missing caretaker.");

  const db = getFirestore();
  const [callerSnap, caretakerSnap, caretakerRecordSnap] = await Promise.all([
    db.doc(`users/${callerUid}`).get(),
    db.doc(`users/${caretakerId}`).get(),
    db.doc(`caretakers/${caretakerId}`).get(),
  ]);
  const caller = callerSnap.exists ? callerSnap.data() : null;
  const caretaker = {
    ...(caretakerRecordSnap.exists ? caretakerRecordSnap.data() : {}),
    ...(caretakerSnap.exists ? caretakerSnap.data() : {}),
  };

  const verdict = canResetCaretakerPassword({ callerUid, caller, caretaker });
  if (!verdict.ok) throw new HttpsError("permission-denied", verdict.reason);

  const tempPassword = newTempPassword(crypto.randomInt);
  const auth = getAuth();
  try {
    await auth.updateUser(caretakerId, { password: tempPassword });
  } catch (err) {
    if (err?.code === "auth/user-not-found") throw new HttpsError("not-found", "This caretaker's sign-in account no longer exists.");
    throw new HttpsError("internal", "Couldn't set the new password. Please try again.");
  }
  // Anyone still signed in with the old password is signed out
  await auth.revokeRefreshTokens(caretakerId).catch(() => {});

  const stamp = {
    mustChangePassword: true,
    passwordResetAt: FieldValue.serverTimestamp(),
    passwordResetBy: callerUid,
  };
  await Promise.all([
    caretakerSnap.exists ? db.doc(`users/${caretakerId}`).update(stamp) : null,
    caretakerRecordSnap.exists ? db.doc(`caretakers/${caretakerId}`).update(stamp) : null,
  ]);

  return {
    email: caretaker.email || "",
    tempPassword,
    fullName: caretaker.name || caretaker.fullName || "",
    phone: caretaker.phone || caretaker.mobilePhone || "",
  };
});
