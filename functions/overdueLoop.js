// functions/overdueLoop.js
//
// Creates "rent overdue" notifications for the tenant and the owner.
// Runs inside localPushListener.js, which then sends the push.
// Set OVERDUE_DRY_RUN=1 to print what would be created without writing.

const crypto = require("crypto");
const { getOverdueInfo, getCurrentPeriod } = require("./src/overdue.js");

const INACTIVE_STATUSES = ["inactive", "archived", "deactivated"];

const isInactive = (record) =>
  INACTIVE_STATUSES.includes(
    String(record.status || "Active").trim().toLowerCase(),
  );

async function loadTenants(db) {
  const [tenantsSnapshot, usersSnapshot] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("users").where("role", "==", "tenant").get(),
  ]);

  const byId = new Map();
  usersSnapshot.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  tenantsSnapshot.docs.forEach((d) =>
    byId.set(d.id, { ...(byId.get(d.id) || {}), ...d.data(), id: d.id }),
  );
  return [...byId.values()];
}

const peso = (n) => `PHP ${Number(n).toLocaleString("en-PH")}`;

async function processOverdue(db, { dryRun = false } = {}) {
  const now = new Date();
  const { period } = getCurrentPeriod(now);

  const [tenants, paymentsSnapshot] = await Promise.all([
    loadTenants(db),
    db.collection("payments").where("periodMonth", "==", period).get(),
  ]);

  const hasPayment = new Set(paymentsSnapshot.docs.map((d) => d.data().tenantId));

  let overdue = 0;
  let created = 0;

  for (const tenant of tenants) {
    if (isInactive(tenant)) continue;

    const tenantId = tenant.uid || tenant.id;
    const info = getOverdueInfo(tenant, now, hasPayment.has(tenantId));
    if (!info) continue;
    overdue += 1;

    const ownerId =
      tenant.ownerUid || tenant.ownerId || tenant.landlordUid || tenant.userId;
    const tenantName = tenant.fullName || tenant.name || "Tenant";
    const propertyId = tenant.propertyId || tenant.assignedPropertyId || null;

    const messages = [
      {
        userId: tenantId,
        title: "Your rent is overdue",
        message: `Your ${info.period} rent of ${peso(info.rent)} was due on ${info.dueLabel}. Please pay or contact your landlord.`,
      },
      {
        userId: ownerId,
        title: "Tenant rent overdue",
        message: `${tenantName}'s ${info.period} rent of ${peso(info.rent)} was due on ${info.dueLabel} and has no payment yet.`,
      },
    ];

    for (const item of messages) {
      if (!item.userId) continue;

      if (dryRun) {
        console.log(`[overdue:dry] ${tenantName} -> ${item.userId}: ${item.title}`);
        continue;
      }

      // Stable ID: one reminder per tenant, month and recipient.
      const id = crypto
        .createHash("sha256")
        .update(`overdue:${tenantId}:${info.periodKey}:${item.userId}`)
        .digest("hex");

      try {
        await db.collection("notifications").doc(id).create({
          userId: item.userId,
          kind: "payment",
          category: "payment",
          type: "error",
          title: item.title,
          message: item.message,
          ownerId: ownerId || null,
          tenantId,
          propertyId,
          periodMonth: info.period,
          isRead: false,
          createdBy: "system",
          createdAt: new Date().toISOString(),
        });
        created += 1;
      } catch (error) {
        if (error.code === 6) continue; // already sent this month
        throw error;
      }
    }
  }

  return { tenants: tenants.length, overdue, created };
}

function startOverdueLoop(
  db,
  { intervalMinutes = 60, startDelaySeconds = 45 } = {},
) {
  const dryRun = process.env.OVERDUE_DRY_RUN === "1";
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const r = await processOverdue(db, { dryRun });
      console.log(
        `[${new Date().toLocaleTimeString()}] [overdue] checked ${r.tenants} tenant(s), ${r.overdue} overdue, ${r.created} notification(s) created${dryRun ? " (dry run)" : ""}`,
      );
    } catch (error) {
      console.error("[overdue] check failed:", error);
    } finally {
      running = false;
    }
  };

  setTimeout(run, startDelaySeconds * 1000);
  setInterval(run, intervalMinutes * 60 * 1000);

  console.log(
    `[overdue] check starts in ${startDelaySeconds}s, then every ${intervalMinutes} min${dryRun ? " (DRY RUN)" : ""}`,
  );
}

module.exports = { startOverdueLoop, processOverdue };
