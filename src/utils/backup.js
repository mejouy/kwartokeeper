// Backups: everything an owner (or, for the admin, the whole platform) has in
// the database, downloaded as one JSON file. The free plan has no automatic
// database backups, so this is the way to keep a copy.
//
// Photos and documents stay where they are (Cloudinary); the backup keeps their links.
// Sign-in secrets and device tokens are left out.
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebase";

const LEFT_OUT = new Set(["password", "tempPassword", "passwordHash", "token", "fcmToken", "fcmTokens", "pushToken"]);

// Timestamps become ISO dates; secrets are dropped
function plain(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") {
    if (typeof value.latitude === "number" && typeof value.longitude === "number") return { latitude: value.latitude, longitude: value.longitude };
    if (typeof value.path === "string" && typeof value.id === "string" && value.firestore) return value.path; // a document reference
    return Object.fromEntries(Object.entries(value).filter(([k]) => !LEFT_OUT.has(k)).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

const read = async (q) => {
  try {
    return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  } catch (err) {
    console.warn("Backup: part couldn't be read:", err?.code || err);
    return null; // reported as missing, the rest of the backup still downloads
  }
};

// Several reads of the same collection merged by document id
function merge(lists) {
  const byId = new Map();
  lists.filter(Boolean).flat().forEach((r) => byId.set(r.id, { ...(byId.get(r.id) || {}), ...r }));
  return [...byId.values()];
}

function download(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const today = () => new Date().toISOString().slice(0, 10);
const summarize = (collections) => Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length]));

/** Everything that belongs to one owner. Returns { counts, missing } for the confirmation message. */
export async function downloadOwnerBackup(uid) {
  const mine = (c, field = "ownerUid") => query(collection(db, c), where(field, "==", uid));
  const properties = (await read(mine("properties"))) || [];
  const byProperty = (c) => properties.map((p) => read(query(collection(db, c), where("propertyId", "==", p.id))));

  const [profile, tenants, users, caretakers, payments, charges, tickets, occupancy, curfew, announcements, activity, propTenants, propUsers, propPayments, propTickets, propOccupancy] = await Promise.all([
    getDoc(doc(db, "users", uid)).then((s) => (s.exists() ? [{ id: s.id, ...plain(s.data()) }] : [])).catch(() => null),
    read(mine("tenants")),
    read(mine("users")),
    read(mine("caretakers")),
    read(mine("payments")),
    read(mine("charges")),
    read(mine("maintenance_tickets")),
    read(mine("occupancy_logs")),
    read(mine("curfew_records")),
    read(mine("owner_announcements", "ownerId")),
    read(mine("audit_logs")),
    Promise.all(byProperty("tenants")),
    Promise.all(byProperty("users")),
    Promise.all(byProperty("payments")),
    Promise.all(byProperty("maintenance_tickets")),
    Promise.all(byProperty("occupancy_logs")),
  ]);

  const collections = {
    profile: profile || [],
    properties,
    tenants: merge([tenants, ...propTenants]),
    people: merge([users, ...propUsers]), // tenant and caretaker accounts
    caretakers: caretakers || [],
    payments: merge([payments, ...propPayments]),
    fees: charges || [],
    repairs: merge([tickets, ...propTickets]),
    curfewSheets: merge([occupancy, ...propOccupancy]),
    curfewRecords: curfew || [],
    announcements: announcements || [],
    caretakerActivity: activity || [],
  };
  const missing = Object.entries({ profile, tenants, users, caretakers, payments, charges, tickets, occupancy, curfew, announcements, activity }).filter(([, v]) => v === null).map(([k]) => k);
  download({ app: "KwartoKeeper", kind: "owner-backup", ownerUid: uid, exportedAt: new Date().toISOString(), counts: summarize(collections), missing, collections }, `kwartokeeper-backup-${today()}.json`);
  return { counts: summarize(collections), missing };
}

const ADMIN_COLLECTIONS = ["users", "properties", "tenants", "caretakers", "payments", "charges", "maintenance_tickets", "maintenance", "occupancy_logs", "curfew_records", "announcements", "owner_announcements", "audit_logs", "settings"];

/** The whole platform (admins only). Notifications are left out: they're many and can be resent. */
export async function downloadPlatformBackup() {
  const results = await Promise.all(ADMIN_COLLECTIONS.map((c) => read(collection(db, c))));
  const collections = Object.fromEntries(ADMIN_COLLECTIONS.map((c, i) => [c, results[i] || []]));
  const missing = ADMIN_COLLECTIONS.filter((_, i) => results[i] === null);
  download({ app: "KwartoKeeper", kind: "platform-backup", exportedAt: new Date().toISOString(), counts: summarize(collections), missing, collections }, `kwartokeeper-platform-backup-${today()}.json`);
  return { counts: summarize(collections), missing };
}
