import { describe, expect, it } from "vitest";
import { buildProofCheck, checkReference, compareAmount, compareWithReceipt, findDuplicateRef, parseReceiptText, proofFindings } from "./paymentProof";

const GCASH_RECEIPT = `Sent via GCash
Amount 3,500.00
Total Amount Sent ₱3,500.00
Ref No. 1023 456 789012
Nov 7, 2026 9:41 AM`;

describe("reference numbers", () => {
  it("checks the format for each method", () => {
    expect(checkReference("GCash", "1023 456 789012")).toBe("");
    expect(checkReference("GCash", "12345")).toMatch(/13 digits/);
    expect(checkReference("Maya", "A1B2C3D4E5F6")).toBe("");
    expect(checkReference("Bank transfer", "x")).not.toBe("");
    expect(checkReference("GCash", "")).not.toBe("");
  });

  it("finds a reference number used before, ignoring spaces and rejected payments", () => {
    const payments = [
      { id: "p1", referenceNumber: "1023456789012", status: "Paid", periodMonth: "October 2026" },
      { id: "p2", referenceNumber: "999", status: "Rejected" },
    ];
    expect(findDuplicateRef("1023 456 789012", payments)?.id).toBe("p1");
    expect(findDuplicateRef("1023456789012", payments, "p1")).toBeNull();
    expect(findDuplicateRef("999", payments)).toBeNull();
  });

  it("compares the amount with what is due", () => {
    expect(compareAmount(3000, 3000)).toBe("match");
    expect(compareAmount(1000, 3000)).toBe("short");
    expect(compareAmount(5000, 3000)).toBe("over");
    expect(compareAmount(0, 3000)).toBe("unknown");
  });
});

describe("reading a receipt", () => {
  it("finds the amount and the reference number", () => {
    const parsed = parseReceiptText(GCASH_RECEIPT);
    expect(parsed.amounts).toContain(3500);
    expect(parsed.refs).toContain("1023456789012");
  });

  it("matches what the tenant typed", () => {
    const parsed = parseReceiptText(GCASH_RECEIPT);
    expect(compareWithReceipt(parsed, { amount: "3500", referenceNumber: "1023 456 789012" })).toEqual({ amountMatch: true, refMatch: true });
    expect(compareWithReceipt(parsed, { amount: "5000", referenceNumber: "1111111111111" })).toEqual({ amountMatch: false, refMatch: false });
    expect(compareWithReceipt(parseReceiptText(""), { amount: "5000", referenceNumber: "1" })).toEqual({ amountMatch: null, refMatch: null });
  });

  it("turns the checks into findings for the owner", () => {
    const check = buildProofCheck({ method: "GCash", amount: 5000, referenceNumber: "1023456789012", due: 3500, ocrText: GCASH_RECEIPT, hadImage: true, duplicateOf: { id: "p1", periodMonth: "October 2026", tenantName: "Ana" } });
    expect(check.ocr).toMatchObject({ ran: true, read: true, amountMatch: false, refMatch: true });
    const texts = proofFindings(check).map((f) => f.text).join(" | ");
    expect(texts).toMatch(/Same reference number/);
    expect(texts).toMatch(/More than what is due/);
    expect(texts).toMatch(/receipt shows ₱3,500/);
    expect(proofFindings(buildProofCheck({ method: "GCash", amount: 3500, referenceNumber: "1023456789012", due: 3500, ocrText: GCASH_RECEIPT, hadImage: true }))).toEqual([
      { tone: "success", text: "The receipt matches the amount and reference number." },
    ]);
  });
});
