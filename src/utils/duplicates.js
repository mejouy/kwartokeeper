// Stops the same person or property from being entered twice.
//
// Sign-in emails are already unique (Firebase Authentication refuses a second
// account), so these checks cover what it can't see: the same mobile number or
// ID on two current tenants or caretakers, and two properties with the same
// name or street address. Only the owner's own records are compared, and
// former tenants (Inactive) and deleted accounts don't count, so someone can
// move back in.
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { isRemovedAccount } from "./accountState";

const INACTIVE = new Set(["inactive", "archived", "deactivated", "moved out", "moved_out"]);
const isCurrent = (r) => !isRemovedAccount(r) && !INACTIVE.has(String(r.status || "Active").trim().toLowerCase());

/** "+63 917 123 4567", "0917-123-4567" and "9171234567" are the same number. */
export function phoneKey(value) {
  let d = String(value || "").replace(/\D/g, "");
  if (d.startsWith("63") && d.length === 12) d = `0${d.slice(2)}`;
  if (d.startsWith("9") && d.length === 10) d = `0${d}`;
  return d.length >= 7 ? d : "";
}
const textKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const idKey = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const emailKey = (value) => String(value || "").trim().toLowerCase();

async function ownerPeople(ownerUid) {
  const [tenants, users, caretakers] = await Promise.all(
    [
      query(collection(db, "tenants"), where("ownerUid", "==", ownerUid)),
      query(collection(db, "users"), where("ownerUid", "==", ownerUid)),
      query(collection(db, "caretakers"), where("ownerUid", "==", ownerUid)),
    ].map((q) => getDocs(q).catch(() => null))
  );
  const byId = new Map();
  const add = (snap, role) =>
    snap?.docs.forEach((d) => {
      const data = d.data();
      const prev = byId.get(d.id) || {};
      byId.set(d.id, { ...prev, ...data, id: d.id, role: data.role || prev.role || role });
    });
  add(users, "");
  add(tenants, "tenant");
  add(caretakers, "caretaker");
  return [...byId.values()].filter(isCurrent);
}

const who = (p) => `${p.name || p.fullName || "Someone"} (${p.role === "caretaker" ? "caretaker" : "tenant"})`;

/**
 * First clash with one of this owner's current tenants or caretakers, or null.
 * Returns { field, message } so the form can point at the right field.
 * excludeId: the person being edited.
 */
export async function findDuplicatePerson(ownerUid, { email, phone, idType, idNumber, excludeId = "" }) {
  if (!ownerUid) return null;
  const people = (await ownerPeople(ownerUid)).filter((p) => p.id !== excludeId);
  const mail = emailKey(email);
  const tel = phoneKey(phone);
  const idNo = idKey(idNumber);

  if (mail) {
    const hit = people.find((p) => emailKey(p.email) === mail);
    if (hit) return { field: "email", message: `${who(hit)} already uses this email.` };
  }
  if (tel) {
    const hit = people.find((p) => [p.phone, p.mobilePhone, p.contactNumber, p.contact].some((v) => phoneKey(v) === tel));
    if (hit) return { field: "phone", message: `${who(hit)} already uses this mobile number.` };
  }
  if (idNo) {
    const hit = people.find((p) => idKey(p.idNumber) === idNo && (!idType || !p.idType || p.idType === idType));
    if (hit) return { field: "idNumber", message: `${who(hit)} is already registered with this ID number.` };
  }
  return null;
}

const addressKey = (a = {}) => [a.street, a.barangay, a.cityMunicipality].map(textKey).join("|");

/**
 * A property this owner already has with the same name or the same street
 * address, or null. Archived properties don't count.
 */
export async function findDuplicateProperty(ownerUid, { propertyName, address, excludeId = "" }) {
  if (!ownerUid) return null;
  const snap = await getDocs(query(collection(db, "properties"), where("ownerUid", "==", ownerUid)));
  const others = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.id !== excludeId && isCurrent(p));
  const name = textKey(propertyName);
  if (name) {
    const hit = others.find((p) => textKey(p.propertyName || p.name) === name);
    if (hit) return { field: "propertyName", message: `You already have a property named "${hit.propertyName || hit.name}". Use a different name.` };
  }
  const addr = address && address.street ? addressKey(address) : "";
  if (addr && !addr.startsWith("|")) {
    const hit = others.find((p) => p.address && addressKey(p.address) === addr);
    if (hit) return { field: "street", message: `"${hit.propertyName || hit.name}" is already at this address.` };
  }
  return null;
}
