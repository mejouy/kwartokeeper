import { doc, runTransaction } from "firebase/firestore";
import { issuerFromProfile } from "./receiptPrint";

// Receipt numbers run in one sequence per owner. The owner sets an optional prefix and the next
// number on the Account page, so the series can match their BIR-registered receipt/invoice booklet.

export const formatReceiptNo = (prefix, seq) => `${String(prefix || "").trim()}${String(seq).padStart(6, "0")}`;

// Reserve the next number inside a transaction. Do all other reads first, then call this, then write.
export async function reserveReceiptNo(tx, db, ownerUid) {
  const ref = doc(db, "users", ownerUid);
  const snap = await tx.get(ref);
  const data = snap.exists() ? snap.data() : {};
  const seq = Math.max(1, Math.floor(Number(data.receiptNextNo)) || 1);
  tx.set(ref, { receiptNextNo: seq + 1 }, { merge: true });
  return { receiptNo: formatReceiptNo(data.receiptPrefix, seq), receiptSeq: seq, receiptIssuedAt: new Date().toISOString(),
    // frozen copy of who issued it, so later edits to the owner's details don't change old receipts
    receiptIssuer: issuerFromProfile(data),
  };
}

// Number a payment that was marked Paid before numbering existed. Safe to call twice.
export function issueReceipt(db, ownerUid, paymentId) {
  return runTransaction(db, async (tx) => {
    const paymentRef = doc(db, "payments", paymentId);
    const snap = await tx.get(paymentRef);
    const existing = snap.data()?.receiptNo;
    if (existing) return existing;
    const issued = await reserveReceiptNo(tx, db, ownerUid);
    tx.update(paymentRef, issued);
    return issued.receiptNo;
  });
}

// Number every un-numbered Paid payment, oldest first, so the journal reads in date order.
export async function issueMissingReceipts(db, ownerUid, payments) {
  let done = 0;
  for (const p of payments) {
    await issueReceipt(db, ownerUid, p.id);
    done += 1;
  }
  return done;
}