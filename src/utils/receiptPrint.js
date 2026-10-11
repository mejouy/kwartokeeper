// Builds the printable rent receipt and prints it from a hidden frame (no pop-up needed, so it also
// works from a phone: choose "Save as PDF" in the print dialog).

const esc = (v) =>
  String(v ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const vatLabel = (v) => (v === "vat" ? "VAT Registered" : v === "non_vat" ? "NON-VAT Registered" : "");

// Snapshot of the owner's business details, saved on the payment when the receipt number is issued
export const issuerFromProfile = (p = {}) => ({
  name: p.registeredName || p.fullName || p.name || "",
  tin: p.tinNumber || "",
  address: p.businessAddress || "",
  vatStatus: p.vatStatus || "",
});

export function buildReceiptHtml(r) {
  const issuer = r.issuer || {};
  const lines = [issuer.tin ? `TIN: ${issuer.tin}` : "", issuer.address || "", vatLabel(issuer.vatStatus)].filter(Boolean);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Receipt ${esc(r.receiptNo)}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:32px;color:#222}
    .receipt{max-width:560px;margin:auto;border:1px solid #ddd;padding:28px}
    h1{text-align:center;font-size:20px;margin:0 0 4px;text-transform:uppercase}
    .issuer{text-align:center;color:#555;font-size:12px;line-height:1.5}
    .sub{text-align:center;font-weight:bold;letter-spacing:.06em;margin:18px 0 6px}
    .no{text-align:center;color:#444;margin-bottom:20px}
    .row{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid #eee}
    .label{color:#666}.amount{font-size:24px;font-weight:bold;text-align:center;margin:24px 0}
    .footer{text-align:center;color:#666;font-size:12px;margin-top:28px}
    @media print{body{padding:0}.receipt{border:0}}
  </style></head><body><div class="receipt">
  <h1>${esc(issuer.name || "KwartoKeeper")}</h1>
  <div class="issuer">${lines.map(esc).join("<br>")}</div>
  <div class="sub">RENT RECEIPT</div>
  <div class="no">No. <strong>${esc(r.receiptNo)}</strong></div>
  <div class="row"><span class="label">Received from</span><span>${esc(r.tenant)}</span></div>
  <div class="row"><span class="label">Property</span><span>${esc(r.property)}</span></div>
  <div class="row"><span class="label">Room</span><span>${esc(r.room)}</span></div>
  <div class="row"><span class="label">In payment of</span><span>Rent for ${esc(r.period)}</span></div>
  <div class="row"><span class="label">Date received</span><span>${esc(r.dateText)}</span></div>
  <div class="row"><span class="label">Payment method</span><span>${esc(r.method)}</span></div>
  <div class="amount">${esc(r.amountText)}</div>
  ${r.remarks ? `<div class="row"><span class="label">Remarks</span><span>${esc(r.remarks)}</span></div>` : ""}
  <div class="footer">Thank you. Keep this receipt for your records.</div>
  </div></body></html>`;
}

export function printReceipt(r) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  win.document.open();
  win.document.write(buildReceiptHtml(r));
  win.document.close();
  win.onafterprint = () => setTimeout(() => iframe.remove(), 500);
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 60000);
  }, 250);
}