// How caretakers are assigned to properties (panel revisions, client:
// "caretaker assignment, one is to many"). The owner picks the rule; the
// default stays one caretaker per property and one property per caretaker.
//
//   one_to_one    one property per caretaker, one caretaker per property (default)
//   one_to_many   a caretaker can have several properties; a property has one caretaker
//   many_to_one   a property can have several caretakers; a caretaker has one property
//   many_to_many  both
//
// A caretaker record keeps every property they look after in
// assignedPropertyIds (with their names in assignedPropertyNames), and the one
// they are working on now in assignedPropertyId. Everything a caretaker can see
// and do (firestore.rules) follows assignedPropertyId, so a caretaker with
// several properties switches between them; they can only switch to a property
// in their own list, which only the owner sets.
import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export const ASSIGNMENT_MODES = [
  { key: "one_to_one", label: "One caretaker, one property", hint: "Each caretaker looks after one property, and each property has one caretaker.", multiProperty: false, sharedProperty: false },
  { key: "one_to_many", label: "One caretaker, many properties", hint: "A caretaker can look after several properties. Each property still has one caretaker.", multiProperty: true, sharedProperty: false },
  { key: "many_to_one", label: "Many caretakers, one property", hint: "A property can have several caretakers. Each caretaker looks after one property.", multiProperty: false, sharedProperty: true },
  { key: "many_to_many", label: "Many caretakers, many properties", hint: "Caretakers can share properties and look after several each.", multiProperty: true, sharedProperty: true },
];
export const DEFAULT_ASSIGNMENT_MODE = "one_to_one";
export const modeOf = (key) => ASSIGNMENT_MODES.find((m) => m.key === key) || ASSIGNMENT_MODES[0];

const INACTIVE = ["inactive", "archived", "deactivated", "removed"];
const isActive = (c) => !c?.accountRemoved && !INACTIVE.includes(String(c?.status || "Active").trim().toLowerCase());

/** Every property a caretaker looks after (older records only have the one). */
export function propertyIdsOf(caretaker) {
  const list = Array.isArray(caretaker?.assignedPropertyIds) ? caretaker.assignedPropertyIds.filter(Boolean) : [];
  const active = caretaker?.assignedPropertyId || caretaker?.propertyId || "";
  return [...new Set(active ? [active, ...list] : list)];
}

/** Properties already looked after by OTHER active caretakers: Map(propertyId → [names]). */
export function takenProperties(caretakers = [], exceptId = "") {
  const map = new Map();
  caretakers
    .filter((c) => (c.id || c.uid) !== exceptId && isActive(c))
    .forEach((c) => propertyIdsOf(c).forEach((pid) => map.set(pid, [...(map.get(pid) || []), c.name || c.fullName || "another caretaker"])));
  return map;
}

/** "" when the assignment follows the owner's rule, else what is wrong. */
export function validateAssignment({ mode, propertyIds = [], caretakerId = "", caretakers = [], propertyName = (id) => id }) {
  const m = modeOf(mode);
  if (!propertyIds.length) return "Please select a property.";
  if (!m.multiProperty && propertyIds.length > 1) return "Your caretaker rule allows one property per caretaker. Change the rule on the Caretakers page to allow more.";
  if (!m.sharedProperty) {
    const taken = takenProperties(caretakers, caretakerId);
    const clash = propertyIds.find((id) => taken.has(id));
    if (clash) return `${propertyName(clash)} already has a caretaker (${taken.get(clash).join(", ")}). Your caretaker rule allows one caretaker per property.`;
  }
  return "";
}

/**
 * Fields to save on the caretaker (users and caretakers records).
 * Keeps the property they are working on when it is still theirs.
 */
export function assignmentFields(propertyIds, { current = "", names = {} } = {}) {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  return {
    assignedPropertyIds: ids,
    assignedPropertyNames: Object.fromEntries(ids.map((id) => [id, String(names[id] || "")])),
    assignedPropertyId: ids.includes(current) ? current : ids[0] || "",
  };
}

/** Caretakers whose assignment breaks a (stricter) rule: [{ caretaker, problem }]. */
export function assignmentConflicts(mode, caretakers = []) {
  const m = modeOf(mode);
  const out = [];
  const active = caretakers.filter(isActive);
  active.forEach((c) => {
    if (!m.multiProperty && propertyIdsOf(c).length > 1) out.push({ caretaker: c, problem: "has more than one property" });
  });
  if (!m.sharedProperty) {
    const seen = new Map();
    active.forEach((c) =>
      propertyIdsOf(c).forEach((pid) => {
        if (seen.has(pid) && seen.get(pid) !== (c.id || c.uid)) out.push({ caretaker: c, problem: "shares a property with another caretaker" });
        else seen.set(pid, c.id || c.uid);
      })
    );
  }
  return out;
}

export const saveAssignmentMode = (ownerUid, mode) => updateDoc(doc(db, "users", ownerUid), { caretakerAssignmentMode: modeOf(mode).key });

/** The owner's rule, live (defaults to one_to_one until loaded or when never set). */
export function useAssignmentMode(ownerUid) {
  const [state, setState] = useState({ uid: "", mode: DEFAULT_ASSIGNMENT_MODE });
  useEffect(() => {
    if (!ownerUid) return undefined;
    return onSnapshot(
      doc(db, "users", ownerUid),
      (snap) => setState({ uid: ownerUid, mode: modeOf(snap.data()?.caretakerAssignmentMode).key }),
      (err) => console.warn("Couldn't load the caretaker rule:", err?.code || err)
    );
  }, [ownerUid]);
  return state.uid === ownerUid ? state.mode : DEFAULT_ASSIGNMENT_MODE;
}

/** A caretaker switches the property they are working on (only one of their own). */
export const switchActiveProperty = (uid, propertyId) =>
  updateDoc(doc(db, "users", uid), { assignedPropertyId: propertyId, activePropertyChangedAt: new Date().toISOString() });
