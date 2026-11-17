// Checking a payment before the owner approves it (panel revisions: "data
// validation ng proof of payment, pwede OCR"):
//   1. The reference number looks right for the method (GCash: 13 digits).
//   2. The same reference number wasn't used for another payment.
//   3. The amount matches what is due.
//   4. OCR: the receipt screenshot is read on the phone (tesseract.js) and
//      compared with the amount and reference number the tenant typed.
// A tenant sees warnings and can still send the payment; the owner sees the
// same findings as flags when reviewing it. Nothing here approves or rejects.

const MAX_TEXT = 600; // characters of receipt text kept on the payment

export const normalizeRef = (ref) => String(ref || "").toUpperCase().replace(/[\s-]/g, "");

// What a reference number looks like for each way of paying
export const REF_RULES = {
  GCash: { test: (r) => /^\d{13}$/.test(r), hint: "GCash reference numbers have 13 digits." },
  Maya: { test: (r) => /^[A-Z0-9]{6,20}$/.test(r), hint: "Maya reference numbers are 6 to 20 letters and numbers." },
  "QR Ph": { test: (r) => /^[A-Z0-9]{6,30}$/.test(r), hint: "Reference numbers are 6 to 30 letters and numbers." },
  "Bank transfer": { test: (r) => /^[A-Z0-9]{6,30}$/.test(r), hint: "Reference numbers are 6 to 30 letters and numbers." },
};

/** "" when the reference looks right for the method, else what is off. */
export function checkReference(method, ref) {
  const r = normalizeRef(ref);
  if (!r) return "Enter the reference number from your payment.";
  const rule = REF_RULES[method];
  if (rule && !rule.test(r)) return rule.hint;
  if (!rule && r.length < 4) return "That reference number looks too short.";
  return "";
}

/** Another payment (not rejected) with the same reference number, or null. */
export function findDuplicateRef(ref, payments = [], excludeId = "") {
  const r = normalizeRef(ref);
  if (r.length < 4) return null;
  return (
    payments.find(
      (p) => p.id !== excludeId && String(p.status || "").toLowerCase() !== "rejected" && normalizeRef(p.referenceNumber) === r
    ) || null
  );
}

/** How the amount compares with what is due: "match" · "short" · "over" · "unknown". */
export function compareAmount(amount, due) {
  const a = Math.round((Number(amount) || 0) * 100);
  const d = Math.round((Number(due) || 0) * 100);
  if (!(a > 0) || !(d > 0)) return "unknown";
  if (a === d) return "match";
  return a < d ? "short" : "over";
}

/* ---------------- Reading the receipt (OCR) ---------------- */

const toNumber = (s) => Number(String(s).replace(/[^\d.]/g, ""));

/**
 * Amounts and reference numbers found in a receipt's text.
 * Amounts: peso signs or "PHP"/"Amount" labels, or numbers with centavos.
 * References: a "Ref"/"Reference" label, or GCash's 13 digits (often 4-3-6).
 */
export function parseReceiptText(text) {
  const raw = String(text || "");
  const amounts = new Set();
  const amountPatterns = [
    /(?:₱|PHP|Php|P)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    /(?:amount|total|sent|paid)[^\d\n]{0,20}(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi,
    /\b(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})\b/g,
  ];
  amountPatterns.forEach((re) => {
    for (const m of raw.matchAll(re)) {
      const n = toNumber(m[1]);
      if (n > 0 && n < 10000000) amounts.add(Math.round(n * 100) / 100);
    }
  });

  const refs = new Set();
  for (const m of raw.matchAll(/ref(?:erence)?\.?\s*(?:no\.?|number|#|id)?\s*[:.]?\s*([A-Z0-9][A-Z0-9 -]{4,30}[A-Z0-9])/gi)) {
    const r = normalizeRef(m[1]);
    if (r.length >= 6) refs.add(r);
  }
  for (const m of raw.matchAll(/\b(\d{4}\s?\d{3}\s?\d{6})\b/g)) refs.add(normalizeRef(m[1]));

  return { amounts: [...amounts], refs: [...refs] };
}

/**
 * Compares what the receipt shows with what the tenant typed.
 * amountMatch / refMatch: true · false · null (nothing readable found).
 */
export function compareWithReceipt(parsed, { amount, referenceNumber }) {
  const typedAmount = Math.round((Number(amount) || 0) * 100) / 100;
  const typedRef = normalizeRef(referenceNumber);
  const amountMatch = parsed.amounts.length ? parsed.amounts.includes(typedAmount) : null;
  // OCR can drop a character, so a reference found inside a longer one still counts
  const refMatch = parsed.refs.length && typedRef ? parsed.refs.some((r) => r === typedRef || r.includes(typedRef) || typedRef.includes(r)) : null;
  return { amountMatch, refMatch };
}

/**
 * Reads the text in a receipt image on this device. Loads the OCR engine only
 * when it is first needed (it downloads its language data once, so it needs
 * the internet the first time). Resolves to "" if it can't read the image.
 */
export async function readReceiptText(image, { timeoutMs = 45000 } = {}) {
  let worker;
  const run = async () => {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("eng");
    const { data } = await worker.recognize(image);
    return data?.text || "";
  };
  const timeout = new Promise((resolve) => setTimeout(() => resolve(""), timeoutMs));
  try {
    return await Promise.race([run(), timeout]);
  } catch (err) {
    console.warn("Couldn't read the receipt:", err?.message || err);
    return "";
  } finally {
    worker?.terminate().catch(() => {});
  }
}

/**
 * Everything checked for one payment, as saved on it (payment.proofCheck) for
 * the owner. `ocrText` is "" when there was no image or it couldn't be read.
 */
export function buildProofCheck({ method, amount, referenceNumber, due, duplicateOf = null, ocrText = "", hadImage = false }) {
  const parsed = parseReceiptText(ocrText);
  const { amountMatch, refMatch } = compareWithReceipt(parsed, { amount, referenceNumber });
  return {
    refFormatOk: !checkReference(method, referenceNumber),
    duplicateOf: duplicateOf ? { id: duplicateOf.id || "", periodMonth: duplicateOf.periodMonth || "", tenantName: duplicateOf.tenantName || "" } : null,
    amountVsDue: compareAmount(amount, due),
    ocr: {
      ran: Boolean(hadImage),
      read: Boolean(ocrText.trim()),
      amountsFound: parsed.amounts.slice(0, 8),
      refsFound: parsed.refs.slice(0, 5),
      amountMatch,
      refMatch,
      text: ocrText.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT),
    },
    checkedAt: new Date().toISOString(),
  };
}

/** Plain-language findings for people: [{ tone, text }] (empty = nothing to flag). */
export function proofFindings(check) {
  if (!check) return [];
  const out = [];
  if (check.duplicateOf) {
    const who = [check.duplicateOf.tenantName, check.duplicateOf.periodMonth].filter(Boolean).join(", ");
    out.push({ tone: "error", text: `Same reference number as another payment${who ? ` (${who})` : ""}.` });
  }
  if (check.refFormatOk === false) out.push({ tone: "warning", text: "The reference number doesn't look like this method's." });
  if (check.amountVsDue === "short") out.push({ tone: "info", text: "Less than what is due (a partial payment)." });
  if (check.amountVsDue === "over") out.push({ tone: "info", text: "More than what is due." });
  const o = check.ocr || {};
  if (o.ran && !o.read) out.push({ tone: "info", text: "The receipt image couldn't be read. Check it yourself." });
  if (o.read && o.amountMatch === false) out.push({ tone: "warning", text: `The receipt shows ${o.amountsFound.map((a) => `₱${Number(a).toLocaleString("en-PH")}`).slice(0, 3).join(", ")}, not the amount typed.` });
  if (o.read && o.refMatch === false) out.push({ tone: "warning", text: "The reference number typed isn't on the receipt." });
  if (o.read && o.amountMatch === true && o.refMatch === true) out.push({ tone: "success", text: "The receipt matches the amount and reference number." });
  return out;
}
