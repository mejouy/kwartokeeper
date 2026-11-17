// Rental contract and house rules in the app (panel revisions, client:
// "contract, integrate sa system (rules and regulations), depende sa owners").
//
// Each property can have its own contract, written by the owner
// (properties/{id}.contract = { enabled, title, body, version, updatedAt }).
// The body can use placeholders such as {tenantName} or {monthlyRent}, filled
// in for each tenant. The property's house rules are added at the end.
// A tenant reads it in the app and agrees; the agreement is saved on their
// profile (users/{uid}.contractAgreement = { propertyId, version, name, agreedAt }).
// When the owner changes the contract its version goes up and tenants are
// asked to agree again. Both sides can download it as a PDF.
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const MAX_CONTRACT_CHARS = 12000;

export const CONTRACT_PLACEHOLDERS = [
  { key: "tenantName", label: "Tenant's name" },
  { key: "ownerName", label: "Owner's name" },
  { key: "propertyName", label: "Property" },
  { key: "propertyAddress", label: "Address" },
  { key: "roomNumber", label: "Room" },
  { key: "bedId", label: "Bed" },
  { key: "monthlyRent", label: "Monthly rent" },
  { key: "dueDay", label: "Due day" },
  { key: "leaseStart", label: "Lease start" },
  { key: "leaseEnd", label: "Lease end" },
  { key: "today", label: "Today's date" },
];

export const STARTER_CONTRACT = `This agreement is between {ownerName} (the owner) and {tenantName} (the tenant) for {roomNumber}, {bedId} at {propertyName}, {propertyAddress}.

1. Term. The stay starts on {leaseStart} and ends on {leaseEnd}, unless both sides agree to extend it.

2. Rent. The rent is {monthlyRent} a month, due every {dueDay} of the month. Rent paid late may be charged the late fee set by the owner.

3. Deposit and advance. Any security deposit is returned when the tenant moves out, less unpaid rent, fees or damage beyond normal wear. Any advance rent pays for the months it was collected for.

4. Use of the room. The room is for the tenant only, for living. The tenant keeps it clean and reports repairs through the app.

5. Utilities and fees. Fees not included in the rent (such as electricity or water) are added to the monthly bill in the app.

6. House rules. The tenant follows the house rules below. Breaking them may end this agreement.

7. Moving out. The tenant gives notice at least 30 days before moving out and returns all keys.`;

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const asDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const longDate = (v) => {
  const d = asDate(v);
  return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
};

/** The property's contract when the owner turned it on and wrote something, else null. */
export const contractOf = (property) => {
  const c = property?.contract;
  return c && c.enabled && String(c.body || "").trim() ? { ...c, version: Number(c.version) || 1 } : null;
};

/** The values the placeholders are filled with, for one tenant. */
export function contractValues({ tenant = {}, property = {}, ownerName = "", today = new Date() }) {
  const day = Math.min(Math.max(Math.round(Number(tenant.rentDueDay || tenant.dueDay || 5)) || 5, 1), 31);
  return {
    tenantName: tenant.name || tenant.fullName || "the tenant",
    ownerName: ownerName || "the owner",
    propertyName: property.propertyName || property.name || tenant.propertyName || "the property",
    propertyAddress: property.addressText || property.address?.full || [property.address?.street, property.address?.barangay, property.address?.cityMunicipality, property.address?.province].filter(Boolean).join(", ") || "",
    roomNumber: tenant.roomNumber || tenant.roomId ? `Room ${tenant.roomNumber || tenant.roomId}` : "the assigned room",
    bedId: tenant.bedId && tenant.bedId !== "N/A" ? tenant.bedId : "the assigned bed",
    monthlyRent: peso(tenant.monthlyRent ?? tenant.rentAmount ?? 0),
    dueDay: day >= 29 ? `${ordinal(day)} (or the month's last day, if shorter)` : ordinal(day),
    leaseStart: longDate(tenant.leaseStartDate || tenant.leaseStart) || "the move-in date",
    leaseEnd: longDate(tenant.leaseEndDate || tenant.leaseEnd) || "the end of the lease",
    today: longDate(today),
  };
}

/** Fills {placeholders}; unknown ones stay as written. */
export const fillContract = (text, values) => String(text || "").replace(/\{(\w+)\}/g, (m, key) => (values[key] !== undefined && values[key] !== "" ? values[key] : m));

/**
 * Where a tenant stands: "none" (no contract) · "pending" (never agreed) ·
 * "outdated" (agreed to an older version) · "agreed".
 */
export function agreementStatus(property, tenant) {
  const contract = contractOf(property);
  if (!contract) return "none";
  const a = tenant?.contractAgreement;
  if (!a || a.propertyId !== (property?.id || tenant?.propertyId)) return "pending";
  return Number(a.version) === contract.version ? "agreed" : "outdated";
}

/** The house rules list of a property (typed rules). */
export const houseRulesOf = (property) =>
  (Array.isArray(property?.rules) ? property.rules : typeof property?.rules === "string" ? property.rules.split("\n") : String(property?.rulesText || "").split("\n")).map((r) => String(r).trim()).filter(Boolean);

/** Builds the contract PDF (A4) and hands it to the person: share sheet in the app, download elsewhere. */
export async function downloadContractPdf({ title, text, rules = [], agreement = null, fileName = "rental-contract.pdf" }) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  let y = M;
  const ensure = (h) => {
    if (y + h > H - M) {
      pdf.addPage();
      y = M;
    }
  };
  const para = (str, { size = 11, bold = false, gap = 8 } = {}) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.splitTextToSize(String(str), W - M * 2).forEach((line) => {
      ensure(size * 1.4);
      pdf.text(line, M, y);
      y += size * 1.4;
    });
    y += gap;
  };

  para(title || "Rental agreement", { size: 18, bold: true, gap: 14 });
  String(text || "")
    .split(/\n\s*\n/)
    .forEach((p) => para(p.trim()));
  if (rules.length) {
    para("House rules", { size: 13, bold: true, gap: 6 });
    rules.forEach((r, i) => para(`${i + 1}. ${r}`, { gap: 2 }));
    y += 8;
  }
  ensure(70);
  pdf.setDrawColor(200);
  pdf.line(M, y, W - M, y);
  y += 18;
  para(
    agreement?.agreedAt
      ? `Agreed in KwartoKeeper by ${agreement.name || "the tenant"} on ${longDate(agreement.agreedAt)} (contract version ${agreement.version}).`
      : "Not yet agreed by the tenant.",
    { size: 10 }
  );

  if (Capacitor.isNativePlatform()) {
    const data = pdf.output("datauristring").split(",")[1];
    const { uri } = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    try {
      await Share.share({ title: title || "Rental agreement", files: [uri], dialogTitle: "Save the contract" });
    } catch (err) {
      if (!/cancel/i.test(String(err?.message || err))) throw err;
    }
    return;
  }
  pdf.save(fileName);
}
