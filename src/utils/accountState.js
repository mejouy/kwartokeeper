// Accounts deleted or disabled in Firebase Authentication.
//
// Deleting or disabling a user in the Firebase console only touches their sign-in
// account; their Firestore profile stays behind. scripts/sync-auth-accounts.cjs
// marks those profiles with `accountRemoved: "deleted" | "disabled"`, and every
// list in the app leaves marked people out.

export const isRemovedAccount = (record) => Boolean(record && record.accountRemoved);

/** The same list without people whose sign-in account was deleted or disabled. */
export const withoutRemoved = (list) => (Array.isArray(list) ? list.filter((x) => !isRemovedAccount(x)) : []);

export const removedLabel = (record) =>
  record?.accountRemoved === "disabled" ? "This account was disabled in Firebase and can't sign in." : "This account was deleted from Firebase and can't sign in.";

// Why someone was signed out (shown once on the login page)
export const SIGNED_OUT_REASON_KEY = "kk_signed_out_reason";
