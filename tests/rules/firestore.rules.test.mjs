// Database rules tests: runs the app's real queries and writes, for every role,
// against firestore.rules in the local Firestore emulator, plus the attacks the
// rules must stop. Nothing touches the real project.
//
// Run: npm run test:rules   (needs Java 21+ and the Firebase CLI)
import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, addDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, runTransaction,
} from "firebase/firestore";

const rulesPath = process.argv[2] || new URL("../../firestore.rules", import.meta.url);
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const env = await initializeTestEnvironment({ projectId: "demo-kk", firestore: { rules: fs.readFileSync(rulesPath, "utf8"), host, port: Number(port) } });

const PERMS = { logOccupancy: true, viewFinancials: true, modifyLayout: true, handleReports: true, manageTenants: true };
const NOV = "November 2026";
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const put = (path, data) => setDoc(doc(db, path), data);
  await put("settings/global", { autoApproveOwners: false });
  await put("users/A", { role: "admin" });
  await put("users/O1", { role: "owner", approvalStatus: "approved", status: "active" });
  await put("users/O2", { role: "owner", approvalStatus: "approved", status: "active" });
  await put("users/OP", { role: "owner", approvalStatus: "pending", status: "pending" });
  await put("users/LEG", { role: "owner" }); // older owner with no approval fields
  await put("properties/P1", { ownerUid: "O1", propertyName: "One" });
  await put("properties/P2", { ownerUid: "O2", propertyName: "Two" });
  for (const [id, owner, prop] of [["C1", "O1", "P1"], ["C2", "O2", "P2"]]) {
    const c = { role: "caretaker", ownerUid: owner, invitedBy: owner, assignedPropertyId: prop, permissions: PERMS, name: id };
    await put(`users/${id}`, c);
    await put(`caretakers/${id}`, c);
  }
  await put("users/C3", { role: "caretaker", ownerUid: "O1", invitedBy: "O1", assignedPropertyId: "P1", permissions: {}, name: "C3" }); // no permissions
  for (const [id, owner, prop] of [["T1", "O1", "P1"], ["T1b", "O1", "P1"], ["T2", "O2", "P2"]]) {
    const t = { role: "tenant", ownerUid: owner, propertyId: prop, name: id, phone: "0917" + id };
    await put(`users/${id}`, t);
    await put(`tenants/${id}`, t);
  }
  await put("payments/pay1", { ownerUid: "O1", tenantId: "T1", propertyId: "P1", periodMonth: NOV, status: "Paid", amount: 3000 });
  await put("payments/pay2", { ownerUid: "O2", tenantId: "T2", propertyId: "P2", periodMonth: NOV, status: "Paid", amount: 3000 });
  await put("payments/payLegacy", { tenantId: "T1", propertyId: "P1", periodMonth: NOV, status: "Paid", amount: 3000 });
  await put("maintenance_tickets/tk1", { ownerUid: "O1", propertyId: "P1", tenantUid: "T1", status: "Pending", title: "Leak" });
  await put("maintenance_tickets/tk2", { ownerUid: "O2", propertyId: "P2", tenantUid: "T2", status: "Pending", title: "Door" });
  await put("occupancy_logs/P1_2026-11-07", { ownerUid: "O1", propertyId: "P1", date: "2026-11-07", entries: {} });
  await put("occupancy_logs/P2_2026-11-07", { ownerUid: "O2", propertyId: "P2", date: "2026-11-07", entries: {} });
  await put("curfew_records/old", { tenantId: "T1", propertyId: "P1", ownerUid: "O1", status: "late", at: Timestamp.fromMillis(Date.now() - 3600_000) });
  await put("charges/ch1", { ownerUid: "O1", tenantId: "T1", propertyId: "P1", amount: 350, label: "Electricity", status: "active", repeat: "once", period: NOV });
  await put("charges/ch2", { ownerUid: "O2", tenantId: "T2", propertyId: "P2", amount: 200, label: "Wi-Fi", status: "active", repeat: "monthly", period: NOV });
  await put("notifications/n1", { userId: "T1", title: "x", isRead: false });
  await put("owner_announcements/a1", { ownerId: "O1", title: "Hi" });
  await put("audit_logs/l1", { ownerUid: "O1", actorUid: "C1", summary: "x", at: Timestamp.now() });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
let pass = 0;
const fails = [];
async function check(label, expect, fn) {
  try {
    await (expect ? assertSucceeds(fn()) : assertFails(fn()));
    pass += 1;
  } catch (err) {
    fails.push(`${expect ? "SHOULD WORK " : "SHOULD FAIL "} ${label}: ${String(err?.message || err).split("\n")[0].slice(0, 160)}`);
  }
}
const q = (db, c, ...w) => getDocs(query(collection(db, c), ...w));
const eq = (f, v) => where(f, "==", v);

// ---------------- Owner O1: every query the owner pages make ----------------
{
  const db = as("O1");
  await check("owner users by ownerUid", true, () => q(db, "users", eq("ownerUid", "O1")));
  await check("owner users by ownerUid+role caretaker", true, () => q(db, "users", eq("ownerUid", "O1"), eq("role", "caretaker")));
  await check("owner users by propertyId", true, () => q(db, "users", eq("propertyId", "P1")));
  await check("owner users by propertyId in", true, () => q(db, "users", where("propertyId", "in", ["P1"])));
  await check("owner users caretakers invitedBy", true, () => q(db, "users", eq("role", "caretaker"), eq("invitedBy", "O1")));
  await check("owner get tenant user", true, () => getDoc(doc(db, "users/T1")));
  await check("owner get caretaker user", true, () => getDoc(doc(db, "users/C1")));
  await check("owner get own profile", true, () => getDoc(doc(db, "users/O1")));
  await check("owner tenants by ownerUid", true, () => q(db, "tenants", eq("ownerUid", "O1")));
  await check("owner tenants by propertyId", true, () => q(db, "tenants", eq("propertyId", "P1")));
  await check("owner tenants by propertyId in", true, () => q(db, "tenants", where("propertyId", "in", ["P1"])));
  await check("owner get tenant", true, () => getDoc(doc(db, "tenants/T1")));
  await check("owner properties by ownerUid", true, () => q(db, "properties", eq("ownerUid", "O1")));
  await check("owner get property", true, () => getDoc(doc(db, "properties/P1")));
  await check("owner payments month", true, () => q(db, "payments", eq("ownerUid", "O1"), eq("periodMonth", NOV)));
  await check("owner payments pending", true, () => q(db, "payments", eq("ownerUid", "O1"), where("status", "in", ["Pending", "pending"])));
  await check("owner payments by tenant", true, () => q(db, "payments", eq("ownerUid", "O1"), eq("tenantId", "T1")));
  await check("owner payments by property (incl. legacy)", true, () => q(db, "payments", eq("propertyId", "P1")));
  await check("owner tickets by ownerUid", true, () => q(db, "maintenance_tickets", eq("ownerUid", "O1")));
  await check("owner tickets by property", true, () => q(db, "maintenance_tickets", eq("propertyId", "P1")));
  await check("owner occupancy by ownerUid", true, () => q(db, "occupancy_logs", eq("ownerUid", "O1")));
  await check("owner occupancy by ownerUid+property", true, () => q(db, "occupancy_logs", eq("ownerUid", "O1"), eq("propertyId", "P1")));
  await check("owner occupancy by ownerUid+date in", true, () => q(db, "occupancy_logs", eq("ownerUid", "O1"), where("date", "in", ["2026-11-07", "2026-11-06"])));
  await check("owner occupancy by property", true, () => q(db, "occupancy_logs", eq("propertyId", "P1")));
  await check("owner caretakers by ownerUid", true, () => q(db, "caretakers", eq("ownerUid", "O1")));
  await check("owner caretakers by ownerUid+userId", true, () => q(db, "caretakers", eq("ownerUid", "O1"), eq("userId", "C1")));
  await check("owner get caretaker record", true, () => getDoc(doc(db, "caretakers/C1")));
  await check("owner charges", true, () => q(db, "charges", eq("ownerUid", "O1")));
  await check("owner charges by tenant", true, () => q(db, "charges", eq("ownerUid", "O1"), eq("tenantId", "T1")));
  await check("owner announcements", true, () => q(db, "owner_announcements", eq("ownerId", "O1")));
  await check("owner activity log", true, () => q(db, "audit_logs", eq("ownerUid", "O1"), eq("actorUid", "C1")));
  await check("owner notifications", true, () => q(db, "notifications", eq("userId", "O1")));
  await check("owner records payment", true, () => addDoc(collection(db, "payments"), { ownerUid: "O1", tenantId: "T1", propertyId: "P1", amount: 100, status: "Paid" }));
  await check("owner verifies payment", true, () => updateDoc(doc(db, "payments/pay1"), { status: "Paid", verifiedBy: "O1" }));
  await check("owner updates legacy payment", true, () => updateDoc(doc(db, "payments/payLegacy"), { remarks: "ok" }));
  await check("owner adds fee", true, () => addDoc(collection(db, "charges"), { ownerUid: "O1", tenantId: "T1", propertyId: "P1", amount: 100, status: "active" }));
  await check("owner removes fee", true, () => updateDoc(doc(db, "charges/ch1"), { status: "removed" }));
  await check("owner registers tenant (users)", true, () => setDoc(doc(db, "users/NEW1"), { role: "tenant", ownerUid: "O1", propertyId: "P1" }));
  await check("owner registers tenant (tenants)", true, () => setDoc(doc(db, "tenants/NEW1"), { role: "tenant", ownerUid: "O1", propertyId: "P1" }));
  await check("owner invites caretaker (users)", true, () => setDoc(doc(db, "users/NEWC"), { role: "caretaker", ownerUid: "O1", assignedPropertyId: "P1" }));
  await check("owner invites caretaker (caretakers)", true, () => setDoc(doc(db, "caretakers/NEWC"), { role: "caretaker", ownerUid: "O1", assignedPropertyId: "P1" }));
  await check("owner edits tenant user", true, () => updateDoc(doc(db, "users/T1"), { phone: "0999" }));
  await check("owner edits tenant record", true, () => updateDoc(doc(db, "tenants/T1"), { phone: "0999" }));
  await check("owner edits caretaker permissions", true, () => updateDoc(doc(db, "users/C1"), { permissions: PERMS, assignedPropertyId: "P1" }));
  await check("owner edits caretaker record", true, () => updateDoc(doc(db, "caretakers/C1"), { permissions: PERMS }));
  await check("owner edits property", true, () => updateDoc(doc(db, "properties/P1"), { propertyName: "One!" }));
  await check("owner creates property", true, () => addDoc(collection(db, "properties"), { ownerUid: "O1", propertyName: "Three" }));
  await check("owner updates ticket", true, () => updateDoc(doc(db, "maintenance_tickets/tk1"), { status: "In Progress" }));
  await check("owner receipt counter", true, () => updateDoc(doc(db, "users/O1"), { receiptSeq: 5 }));
  await check("owner notifies own tenant", true, () => addDoc(collection(db, "notifications"), { userId: "T1", ownerId: "O1", createdBy: "O1", title: "x" }));
  await check("owner lease note to self", true, () => addDoc(collection(db, "notifications"), { userId: "O1", ownerId: "O1", createdBy: "O1", title: "x" }));
  await check("owner announcement batch of 60", true, () => {
    const b = writeBatch(db);
    b.set(doc(collection(db, "owner_announcements")), { ownerId: "O1", title: "x" });
    for (let i = 0; i < 60; i += 1) b.set(doc(collection(db, "notifications")), { userId: `T${i}`, ownerId: "O1", createdBy: "O1", announcementId: "a", title: "x" });
    return b.commit();
  });
  await check("owner fees batch with notes", true, () => {
    const b = writeBatch(db);
    for (let i = 0; i < 20; i += 1) {
      b.set(doc(collection(db, "charges")), { ownerUid: "O1", tenantId: "T1", propertyId: "P1", amount: 50, status: "active" });
      b.set(doc(collection(db, "notifications")), { userId: "T1", ownerId: "O1", createdBy: "O1", title: "fee" });
    }
    return b.commit();
  });

  await check('owner users invitedBy only', true, () => q(db, 'users', eq('invitedBy', 'O1')));
  await check('owner payments by tenant + property (tenant profile, older records)', true, () => q(db, 'payments', eq('propertyId', 'P1'), eq('tenantId', 'T1')));
  await check('owner payments by tenant only (old tenant profile query)', false, () => q(db, 'payments', eq('tenantId', 'T1')));
  await check('owner looks up property caretakers', true, () => q(db, 'users', eq('role', 'caretaker'), eq('assignedPropertyId', 'P1')));
  await check('owner saves older tenant profile (no role)', true, () => setDoc(doc(db, 'users/OLDT'), { ownerUid: 'O1', phone: '1' }, { merge: true }));
  await check("owner backup: curfew records", true, () => q(db, "curfew_records", eq("ownerUid", "O1")));
  await check("owner backup: whole activity log", true, () => q(db, "audit_logs", eq("ownerUid", "O1")));
  await check("owner backup: tickets by property", true, () => q(db, "maintenance_tickets", eq("propertyId", "P1")));
  // Not theirs
  await check("owner reads other owner's payment", false, () => getDoc(doc(db, "payments/pay2")));
  await check("owner lists other property's payments", false, () => q(db, "payments", eq("propertyId", "P2")));
  await check("owner lists all payments", false, () => q(db, "payments"));
  await check("owner lists all tenants", false, () => q(db, "tenants"));
  await check("owner reads other owner's tenant", false, () => getDoc(doc(db, "tenants/T2")));
  await check("owner reads other owner's tenant profile", false, () => getDoc(doc(db, "users/T2")));
  await check("owner lists all users", false, () => q(db, "users"));
  await check("owner reads other owner's caretaker", false, () => getDoc(doc(db, "caretakers/C2")));
  await check("owner reads other owner's property", false, () => getDoc(doc(db, "properties/P2")));
  await check("owner lists other property's tickets", false, () => q(db, "maintenance_tickets", eq("propertyId", "P2")));
  await check("owner edits other owner's ticket", false, () => updateDoc(doc(db, "maintenance_tickets/tk2"), { status: "Resolved" }));
  await check("owner deletes other owner's ticket", false, () => deleteDoc(doc(db, "maintenance_tickets/tk2")));
  await check("owner reads other owner's announcements", false, () => q(db, "owner_announcements", eq("ownerId", "O2")));
  await check("owner reads other owner's fees", false, () => q(db, "charges", eq("ownerUid", "O2")));
  await check("owner adds fee at other property", false, () => addDoc(collection(db, "charges"), { ownerUid: "O1", tenantId: "T2", propertyId: "P2", amount: 100 }));
  await check("owner records payment for other owner", false, () => addDoc(collection(db, "payments"), { ownerUid: "O2", tenantId: "T2", amount: 1 }));
  await check("owner edits other owner's tenant", false, () => updateDoc(doc(db, "users/T2"), { phone: "x" }));
  await check("owner notifies under someone else's name", false, () => addDoc(collection(db, "notifications"), { userId: "T2", ownerId: "O2", createdBy: "O2", title: "x" }));
  await check("owner creates user for other owner", false, () => setDoc(doc(db, "users/NEW2"), { role: "tenant", ownerUid: "O2" }));
  await check("owner creates admin user", false, () => setDoc(doc(db, "users/NEW3"), { role: "admin", ownerUid: "O1" }));
  await check("owner reads other owner's occupancy", false, () => q(db, "occupancy_logs", eq("propertyId", "P2")));
}

// Older owner with no approval fields still counts as approved
await check("legacy owner notifies", true, () => addDoc(collection(as("LEG"), "notifications"), { userId: "T1", ownerId: "LEG", createdBy: "LEG", title: "x" }));

// ---------------- Pending owner / stranger ----------------
{
  const db = as("OP");
  await check("pending owner lists own payments", true, () => q(db, "payments", eq("ownerUid", "OP")));
  await check("pending owner reads someone's payments", false, () => q(db, "payments", eq("propertyId", "P1")));
  await check("pending owner reads tenants", false, () => q(db, "tenants", eq("propertyId", "P1")));
  await check("pending owner messages a tenant", false, () => addDoc(collection(db, "notifications"), { userId: "T1", ownerId: "OP", createdBy: "OP", title: "Send rent here" }));
  await check("pending owner creates property", true, () => addDoc(collection(db, "properties"), { ownerUid: "OP", propertyName: "Mine" }));
  await check("pending owner note to self", true, () => addDoc(collection(db, "notifications"), { userId: "OP", createdBy: "OP", title: "x" }));
}
{
  const s = as("S1");
  await check("stranger signs up as owner (pending)", true, () => setDoc(doc(s, "users/S1"), { role: "owner", approvalStatus: "pending", status: "pending" }));
  const s2 = as("S2");
  await check("stranger makes self caretaker", false, () => setDoc(doc(s2, "users/S2"), { role: "caretaker", assignedPropertyId: "P1", permissions: PERMS, ownerUid: "O1" }));
  await check("stranger makes self tenant", false, () => setDoc(doc(s2, "users/S2"), { role: "tenant", propertyId: "P1", ownerUid: "O1" }));
  await check("stranger self-approves", false, () => setDoc(doc(s2, "users/S2"), { role: "owner", approvalStatus: "approved", status: "active" }));
  await check("stranger reads users", false, () => getDoc(doc(s2, "users/T1")));
  await check("stranger reads property", false, () => getDoc(doc(s2, "properties/P1")));
  await check("stranger messages anyone", false, () => addDoc(collection(s2, "notifications"), { userId: "T1", createdBy: "S2", title: "x" }));
  await check("signed-out reads", false, () => getDoc(doc(env.unauthenticatedContext().firestore(), "users/T1")));
}

// ---------------- Caretaker C1 (property P1, all permissions) ----------------
{
  const db = as("C1");
  await check("caretaker own profile", true, () => getDoc(doc(db, "users/C1")));
  await check("caretaker own record", true, () => getDoc(doc(db, "caretakers/C1")));
  await check("caretaker owner's profile", true, () => getDoc(doc(db, "users/O1")));
  await check("caretaker property", true, () => getDoc(doc(db, "properties/P1")));
  await check("caretaker tenants (users)", true, () => q(db, "users", eq("propertyId", "P1")));
  await check("caretaker tenants (tenants)", true, () => q(db, "tenants", eq("propertyId", "P1")));
  await check("caretaker fellow caretakers", true, () => q(db, "users", eq("role", "caretaker"), eq("assignedPropertyId", "P1")));
  await check("caretaker tickets", true, () => q(db, "maintenance_tickets", eq("propertyId", "P1")));
  await check("caretaker payments", true, () => q(db, "payments", eq("propertyId", "P1")));
  await check("caretaker fees", true, () => q(db, "charges", eq("ownerUid", "O1"), eq("propertyId", "P1")));
  await check("caretaker tonight's sheet", true, () => getDoc(doc(db, "occupancy_logs/P1_2026-11-07")));
  await check("caretaker missing night", true, () => getDoc(doc(db, "occupancy_logs/P1_2026-01-01")));
  await check("caretaker saves sheet", true, () => setDoc(doc(db, "occupancy_logs/P1_2026-11-08"), { propertyId: "P1", ownerUid: "O1", date: "2026-11-08", entries: { T1: { status: "late" } } }, { merge: true }));
  await check("caretaker updates sheet", true, () => setDoc(doc(db, "occupancy_logs/P1_2026-11-07"), { propertyId: "P1", ownerUid: "O1", entries: { T1: { status: "present" } } }, { merge: true }));
  await check("caretaker writes curfew record", true, () => setDoc(doc(db, "curfew_records/P1_2026-11-08_T1"), { tenantId: "T1", propertyId: "P1", ownerUid: "O1", status: "late", at: serverTimestamp() }, { merge: true }));
  await check("caretaker undoes fresh mark", true, () => deleteDoc(doc(db, "curfew_records/P1_2026-11-08_T1")));
  await check("caretaker records cash", true, () => addDoc(collection(db, "payments"), { ownerUid: "O1", tenantId: "T1", propertyId: "P1", paymentMethod: "Cash", amount: 3000, status: "Paid", verificationStatus: "Approved" }));
  await check("caretaker edits rooms", true, () => updateDoc(doc(db, "properties/P1"), { rooms: [], totalRooms: 0, totalBeds: 0, totalFloors: 1, updatedAt: new Date() }));
  await check("caretaker updates ticket", true, () => updateDoc(doc(db, "maintenance_tickets/tk1"), { status: "Resolved", updatedBy: "C1" }));
  await check("caretaker notices batch of 40", true, () => {
    const b = writeBatch(db);
    for (let i = 0; i < 40; i += 1) b.set(doc(collection(db, "notifications")), { userId: `T${i}`, propertyId: "P1", ownerId: "O1", createdBy: "C1", title: "Curfew" });
    return b.commit();
  });
  await check("caretaker notifies owner", true, () => addDoc(collection(db, "notifications"), { userId: "O1", createdBy: "C1", title: "Cash recorded" }));
  await check("caretaker notifies fellow caretaker", true, () => addDoc(collection(db, "notifications"), { userId: "C3", createdBy: "C1", title: "x" }));
  await check("caretaker logs activity", true, () => addDoc(collection(db, "audit_logs"), { ownerUid: "O1", actorUid: "C1", summary: "Recorded cash", at: serverTimestamp() }));
  await check("caretaker reads own activity", true, () => q(db, "audit_logs", eq("actorUid", "C1")));
  await check("caretaker clears own password flag", true, () => updateDoc(doc(db, "caretakers/C1"), { mustChangePassword: false, passwordChangedAt: "now" }));
  await check("caretaker saves push token", true, () => updateDoc(doc(db, "users/C1"), { fcmTokens: ["abc"], mustChangePassword: false }));

  await check("caretaker other property's payments", false, () => q(db, "payments", eq("propertyId", "P2")));
  await check("caretaker all payments", false, () => q(db, "payments"));
  await check("caretaker other tenants", false, () => q(db, "tenants", eq("propertyId", "P2")));
  await check("caretaker owner-wide tenants", false, () => q(db, "tenants", eq("ownerUid", "O1")));
  await check("caretaker other user", false, () => getDoc(doc(db, "users/T2")));
  await check("caretaker other property", false, () => getDoc(doc(db, "properties/P2")));
  await check("caretaker other sheet", false, () => getDoc(doc(db, "occupancy_logs/P2_2026-11-07")));
  await check("caretaker writes other sheet", false, () => setDoc(doc(db, "occupancy_logs/P2_2026-11-08"), { propertyId: "P2", entries: {} }));
  await check("caretaker moves a sheet to other property", false, () => setDoc(doc(db, "occupancy_logs/P2_2026-11-07"), { propertyId: "P1" }, { merge: true }));
  await check("caretaker curfew record elsewhere", false, () => setDoc(doc(db, "curfew_records/x2"), { tenantId: "T2", propertyId: "P2", status: "out", at: serverTimestamp() }));
  await check("caretaker erases old curfew record", false, () => deleteDoc(doc(db, "curfew_records/old")));
  await check("caretaker cash elsewhere", false, () => addDoc(collection(db, "payments"), { ownerUid: "O2", tenantId: "T2", propertyId: "P2", paymentMethod: "Cash", amount: 1 }));
  await check("caretaker cash to wrong owner", false, () => addDoc(collection(db, "payments"), { ownerUid: "O2", tenantId: "T1", propertyId: "P1", paymentMethod: "Cash", amount: 1 }));
  await check("caretaker cash with receipt no.", false, () => addDoc(collection(db, "payments"), { ownerUid: "O1", tenantId: "T1", propertyId: "P1", paymentMethod: "Cash", amount: 1, receiptNo: "9" }));
  await check("caretaker edits other property's rooms", false, () => updateDoc(doc(db, "properties/P2"), { rooms: [] }));
  await check("caretaker edits other ticket", false, () => updateDoc(doc(db, "maintenance_tickets/tk2"), { status: "Resolved" }));
  await check("caretaker notifies other property's tenant", false, () => addDoc(collection(db, "notifications"), { userId: "T2", propertyId: "P2", createdBy: "C1", title: "x" }));
  await check("caretaker notifies random person", false, () => addDoc(collection(db, "notifications"), { userId: "T2", createdBy: "C1", title: "x" }));
  await check("caretaker moves self to other property", false, () => updateDoc(doc(db, "users/C1"), { assignedPropertyId: "P2" }));
  await check("caretaker grants self permissions", false, () => updateDoc(doc(db, "users/C1"), { permissions: { all: true } }));
  await check("caretaker changes own record", false, () => updateDoc(doc(db, "caretakers/C1"), { assignedPropertyId: "P2" }));
  await check("caretaker logs for other owner", false, () => addDoc(collection(db, "audit_logs"), { ownerUid: "O2", actorUid: "C1", summary: "x", at: serverTimestamp() }));
  await check("caretaker logs as someone else", false, () => addDoc(collection(db, "audit_logs"), { ownerUid: "O1", actorUid: "C3", summary: "x", at: serverTimestamp() }));
  await check("caretaker edits activity log", false, () => updateDoc(doc(db, "audit_logs/l1"), { summary: "nothing" }));
  await check("caretaker deletes activity log", false, () => deleteDoc(doc(db, "audit_logs/l1")));
  await check("caretaker reads owner's whole log", false, () => q(db, "audit_logs", eq("ownerUid", "O1")));
}
{
  const db = as("C3"); // no permissions
  await check("caretaker without money access: payments", false, () => q(db, "payments", eq("propertyId", "P1")));
  await check("caretaker without money access: fees", false, () => q(db, "charges", eq("ownerUid", "O1"), eq("propertyId", "P1")));
  await check("caretaker without occupancy: sheet", false, () => setDoc(doc(db, "occupancy_logs/P1_2026-11-09"), { propertyId: "P1" }));
  await check("caretaker without layout: rooms", false, () => updateDoc(doc(db, "properties/P1"), { rooms: [] }));
  await check("caretaker without permissions: tenants", true, () => q(db, "users", eq("propertyId", "P1")));
}


// ---------------- Receipt numbers for caretaker cash ----------------
{
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "users/O1"), { receiptNextNo: 7, receiptPrefix: "OR-" }, { merge: true }));
  const db = as("C1");
  const reserve = (bump = 1, seq = 7, extra = {}) => runTransaction(db, async (tx) => {
    const ownerRef = doc(db, "users/O1");
    const snap = await tx.get(ownerRef);
    const cur = snap.data().receiptNextNo;
    const payRef = doc(collection(db, "payments"));
    tx.set(ownerRef, { receiptNextNo: cur + bump, receiptLastPaymentId: payRef.id, ...extra }, { merge: true });
    tx.set(payRef, { ownerUid: "O1", tenantId: "T1", propertyId: "P1", paymentMethod: "Cash", amount: 3000, status: "Paid", verificationStatus: "Approved", receiptNo: "OR-" + seq, receiptSeq: seq, receiptIssuedAt: "now", receiptIssuer: { name: "x" } });
  });
  await check("caretaker takes the next receipt number", true, () => reserve(1, 7));
  await check("caretaker takes the following one", true, () => reserve(1, 8));
  await check("caretaker skips numbers", false, () => reserve(2, 9));
  await check("caretaker reuses an old number", false, () => reserve(1, 3));
  await check("caretaker edits owner profile while numbering", false, () => reserve(1, 9, { registeredName: "Me" }));
  await check("caretaker bumps counter without a payment", false, () => updateDoc(doc(db, "users/O1"), { receiptNextNo: 10 }));
  await check("caretaker bumps counter naming an old payment", false, () => updateDoc(doc(db, "users/O1"), { receiptNextNo: 10, receiptLastPaymentId: "pay1" }));
  await check("owner still numbers receipts", true, () => updateDoc(doc(as("O1"), "users/O1"), { receiptNextNo: 11 }));
  await check("caretaker of other owner bumps counter", false, () => updateDoc(doc(as("C2"), "users/O1"), { receiptNextNo: 10 }));
  await check("caretaker without money access bumps counter", false, () => updateDoc(doc(as("C3"), "users/O1"), { receiptNextNo: 10 }));
  await check("tenant bumps counter", false, () => updateDoc(doc(as("T1"), "users/O1"), { receiptNextNo: 10 }));
  await check("caretaker cash without a number still works", true, () => addDoc(collection(db, "payments"), { ownerUid: "O1", tenantId: "T1", propertyId: "P1", paymentMethod: "Cash", amount: 1, status: "Paid" }));
}

// ---------------- Tenant T1 ----------------
{
  const db = as("T1");
  await check("tenant own profile", true, () => getDoc(doc(db, "users/T1")));
  await check("tenant own record", true, () => getDoc(doc(db, "tenants/T1")));
  await check("tenant owner profile", true, () => getDoc(doc(db, "users/O1")));
  await check("tenant property", true, () => getDoc(doc(db, "properties/P1")));
  await check("tenant tickets", true, () => q(db, "maintenance_tickets", eq("tenantUid", "T1")));
  await check("tenant payments", true, () => q(db, "payments", eq("tenantId", "T1")));
  await check("tenant fees", true, () => q(db, "charges", eq("tenantId", "T1")));
  await check("tenant notifications", true, () => q(db, "notifications", eq("userId", "T1")));
  await check("tenant curfew", true, () => q(db, "curfew_records", eq("tenantId", "T1")));
  await check("tenant property caretakers", true, () => q(db, "users", eq("role", "caretaker"), eq("assignedPropertyId", "P1")));
  await check("tenant submits payment", true, () => addDoc(collection(db, "payments"), { tenantId: "T1", ownerUid: "O1", propertyId: "P1", status: "Pending", verificationStatus: "Pending", amount: 3000, bill: { rent: 3000 } }));
  await check("tenant reports repair", true, () => addDoc(collection(db, "maintenance_tickets"), { tenantUid: "T1", ownerUid: "O1", propertyId: "P1", status: "Pending" }));
  await check("tenant follows up", true, () => updateDoc(doc(db, "maintenance_tickets/tk1"), { followUps: ["x"], updatedAt: new Date() }));
  await check("tenant notifies owner", true, () => addDoc(collection(db, "notifications"), { userId: "O1", createdBy: "T1", title: "Paid" }));
  await check("tenant notifies caretaker", true, () => addDoc(collection(db, "notifications"), { userId: "C1", createdBy: "T1", title: "Repair" }));
  await check("tenant note to self", true, () => addDoc(collection(db, "notifications"), { userId: "T1", createdBy: "T1", title: "x" }));
  await check("tenant marks read", true, () => updateDoc(doc(db, "notifications/n1"), { isRead: true }));
  await check("tenant saves push token", true, () => updateDoc(doc(db, "users/T1"), { fcmTokens: ["x"] }));

  await check("tenant other payment", false, () => getDoc(doc(db, "payments/pay2")));
  await check("tenant property payments", false, () => q(db, "payments", eq("propertyId", "P1")));
  await check("tenant property tickets", false, () => q(db, "maintenance_tickets", eq("propertyId", "P1")));
  await check("tenant all tickets", false, () => q(db, "maintenance_tickets"));
  await check("tenant roommate profile", false, () => getDoc(doc(db, "users/T1b")));
  await check("tenant other tenant", false, () => getDoc(doc(db, "tenants/T2")));
  await check("tenant all users", false, () => q(db, "users"));
  await check("tenant other property", false, () => getDoc(doc(db, "properties/P2")));
  await check("tenant other fees", false, () => q(db, "charges", eq("ownerUid", "O1")));
  await check("tenant sheet", false, () => getDoc(doc(db, "occupancy_logs/P1_2026-11-07")));
  await check("tenant notifies other tenant", false, () => addDoc(collection(db, "notifications"), { userId: "T2", createdBy: "T1", title: "Pay me" }));
  await check("tenant notifies roommate", false, () => addDoc(collection(db, "notifications"), { userId: "T1b", createdBy: "T1", title: "x" }));
  await check("tenant notifies other caretaker", false, () => addDoc(collection(db, "notifications"), { userId: "C2", createdBy: "T1", title: "x" }));
  await check("tenant fakes sender", false, () => addDoc(collection(db, "notifications"), { userId: "T2", createdBy: "O2", ownerId: "O2", title: "x" }));
  await check("tenant marks own payment paid", false, () => addDoc(collection(db, "payments"), { tenantId: "T1", propertyId: "P1", status: "Paid", verificationStatus: "Approved", amount: 1 }));
  await check("tenant pays at other property", false, () => addDoc(collection(db, "payments"), { tenantId: "T1", propertyId: "P2", status: "Pending", verificationStatus: "Pending", amount: 1 }));
  await check("tenant repair at other property", false, () => addDoc(collection(db, "maintenance_tickets"), { tenantUid: "T1", propertyId: "P2", status: "Pending" }));
  await check("tenant repair as someone else", false, () => addDoc(collection(db, "maintenance_tickets"), { tenantUid: "T2", propertyId: "P1" }));
  await check("tenant moves self to other property", false, () => updateDoc(doc(db, "users/T1"), { propertyId: "P2" }));
  await check("tenant lowers own rent", false, () => updateDoc(doc(db, "users/T1"), { monthlyRent: 1 }));
  await check("tenant edits payment", false, () => updateDoc(doc(db, "payments/pay1"), { amount: 1 }));
  await check("tenant adds fee", false, () => addDoc(collection(db, "charges"), { ownerUid: "O1", tenantId: "T1", propertyId: "P1", amount: 1 }));
  await check("tenant writes activity for owner", false, () => addDoc(collection(db, "audit_logs"), { ownerUid: "O1", actorUid: "T1", summary: "x", at: serverTimestamp() }));
}

// ---------------- Admin ----------------
{
  const db = as("A");
  await check("admin all users", true, () => q(db, "users"));
  await check("admin owners", true, () => q(db, "users", eq("role", "owner")));
  await check("admin all payments", true, () => q(db, "payments"));
  await check("admin all tenants", true, () => q(db, "tenants"));
  await check("admin all properties", true, () => q(db, "properties"));
  await check("admin approves owner", true, () => updateDoc(doc(db, "users/OP"), { approvalStatus: "approved", status: "active" }));
  for (const c of ["caretakers", "charges", "maintenance_tickets", "maintenance", "occupancy_logs", "curfew_records", "announcements", "owner_announcements", "audit_logs", "settings"]) {
    await check("admin backup: " + c, true, () => q(db, c));
  }
  await check("admin notifies anyone", true, () => addDoc(collection(db, "notifications"), { userId: "T2", title: "x" }));
}

console.log(`\n${pass} passed, ${fails.length} failed`);
fails.forEach((f) => console.log("  ✗ " + f));
await env.cleanup();
process.exit(fails.length ? 1 : 0);
