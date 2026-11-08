// Activity log: what caretakers change, so the owner can see who did what and when.
//
// One document per action in `audit_logs`. The database rules only let people
// add entries in their own name (actorUid) with the server's clock (at), and
// nobody can edit or delete an entry afterwards. Logging is best effort: a
// failed log never undoes or blocks the action itself.
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebase";

export const ACTIVITY_CATEGORIES = {
  payment: "Payments",
  curfew: "Curfew",
  repair: "Repairs",
  rooms: "Rooms & rates",
  notice: "Notices",
  account: "Account",
};

/**
 * ownerUid: whose property this is (the owner reads the log)
 * actorName / actorRole: who did it, as shown to the owner
 * category: one of ACTIVITY_CATEGORIES
 * summary: one plain sentence, e.g. "Recorded ₱3,000 cash from Ana Cruz for November 2026"
 * details: optional small map of before/after values
 */
export async function logActivity({ ownerUid, actorName, actorRole = "caretaker", category, action, summary, propertyId = "", propertyName = "", targetId = "", targetName = "", details = null }) {
  const uid = auth.currentUser?.uid;
  if (!uid || !ownerUid || !summary) return;
  try {
    await addDoc(collection(db, "audit_logs"), {
      ownerUid,
      actorUid: uid,
      actorName: actorName || "",
      actorRole,
      category,
      action: action || category,
      summary: String(summary).slice(0, 300),
      propertyId,
      propertyName,
      targetId,
      targetName,
      ...(details ? { details } : {}),
      at: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Activity not logged:", err?.code || err);
  }
}
