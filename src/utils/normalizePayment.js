export function normalizePayment(payment) {
  const rawStatus = String(payment?.status ?? payment?.paymentStatus ?? "").trim();
  const knownStatuses = new Map([
    ["paid", "Paid"],
    ["pending", "Pending"],
    ["partial", "Partial"],
    ["overdue", "Overdue"],
    ["rejected", "Rejected"],
    ["cancelled", "Cancelled"],
  ]);

  return {
    ...payment,
    amount: Number(payment?.amount ?? payment?.amountPaid ?? payment?.rentAmount ?? 0) || 0,
    paymentDate: payment?.paymentDate ?? payment?.paidAt ?? payment?.date ?? payment?.createdAt ?? null,
    periodMonth: payment?.periodMonth ?? payment?.billingPeriod ?? payment?.billingMonth ?? payment?.month ?? "",
    paymentMethod: payment?.paymentMethod ?? payment?.method ?? "",
    status: knownStatuses.get(rawStatus.toLowerCase()) ?? rawStatus,
  };
}
