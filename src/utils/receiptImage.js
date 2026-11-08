// The rent receipt as an image the tenant can keep on their phone.
//
// PNG, not JPG: a receipt is text and lines, which JPG blurs and smudges;
// PNG stays sharp and is still small. The page is a common receipt booklet
// size, half-letter (5.5 × 8.5 in), drawn at print quality (300 dpi), so it
// prints at true size if it's ever needed. Same content as the printed
// receipt (utils/receiptPrint.js).
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { vatLabel } from "./receiptPrint";

export const RECEIPT_PAGE = { widthIn: 5.5, heightIn: 8.5, dpi: 300 };

const W = Math.round(RECEIPT_PAGE.widthIn * RECEIPT_PAGE.dpi); // 1650
const H = Math.round(RECEIPT_PAGE.heightIn * RECEIPT_PAGE.dpi); // 2550
const pt = (n) => Math.round((n * RECEIPT_PAGE.dpi) / 72); // type sizes in points, like a printed form
const FONT = '"Inter", Arial, Helvetica, sans-serif';
const INK = "#1f1f1f";
const MUTED = "#6b6b6b";
const RULE = "#e2e2e2";
const ACCENT = "#ff4500";

const peso = (n) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(Number(n) || 0);

// Splits text into lines that fit `width`; the last allowed line ends with "…"
function wrap(ctx, text, width, maxLines = 99) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines.length ? lines : [""];
}

/** Draws the receipt on a new canvas (r: same fields as printReceipt). */
export function drawReceipt(r) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const issuer = r.issuer || {};
  const margin = pt(26); // ≈ 0.36 in
  const left = margin + pt(14);
  const right = W - margin - pt(14);
  const width = right - left;
  let y = margin + pt(30);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // Thin frame, like a booklet receipt, with a brand stripe on top
  ctx.strokeStyle = "#cfcfcf";
  ctx.lineWidth = 3;
  ctx.strokeRect(margin, margin, W - margin * 2, H - margin * 2);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(margin, margin, W - margin * 2, pt(5));

  const text = (str, x, size, { weight = 400, color = INK, align = "left", spacing = 0 } = {}) => {
    ctx.font = `${weight} ${pt(size)}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = spacing ? `${spacing}px` : "0px";
    ctx.fillText(str, x, y);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  };
  const centered = (str, size, opts = {}, maxLines = 3) => {
    ctx.font = `${opts.weight || 400} ${pt(size)}px ${FONT}`;
    wrap(ctx, str, width, maxLines).forEach((line) => {
      y += pt(size * 1.25);
      text(line, W / 2, size, { ...opts, align: "center" });
    });
  };
  const rule = (gap = 9) => {
    y += pt(gap);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  };
  // Label on the left, value on the right (wrapping to two lines if needed)
  const field = (label, value, { maxLines = 2 } = {}) => {
    const size = 10;
    ctx.font = `400 ${pt(size)}px ${FONT}`;
    const lines = wrap(ctx, value || "—", width * 0.62, maxLines);
    y += pt(18);
    text(label, left, size, { color: MUTED });
    lines.forEach((line, i) => {
      if (i) y += pt(size * 1.3);
      text(line, right, size, { weight: 600, align: "right" });
    });
    rule(9);
  };

  // Who issued it
  y = margin + pt(14);
  centered(String(issuer.name || "KwartoKeeper").toUpperCase(), 15, { weight: 800 }, 2);
  [issuer.tin ? `TIN: ${issuer.tin}` : "", issuer.address || "", vatLabel(issuer.vatStatus)].filter(Boolean).forEach((line) => centered(line, 8.5, { color: MUTED }, 2));

  y += pt(14);
  centered("RENT RECEIPT", 11, { weight: 800, spacing: 6 });
  y += pt(2);
  centered(`No. ${r.receiptNo || "—"}`, 10.5, { weight: 700 });
  y += pt(6);
  rule(0);

  field("Received from", r.tenant);
  field("Property", r.property);
  field("Room", r.room);
  field("In payment of", `${r.partial ? "Partial rent" : "Rent"}${r.bill?.fees?.length ? " and fees" : ""} for ${r.period || "—"}`);
  if (r.bill?.fees?.length) {
    // What the month was billed at
    y += pt(16);
    text("Billed for the month", left, 10, { color: MUTED });
    [["Rent", r.bill.rent], ...r.bill.fees.map((f) => [f.label, f.amount])].slice(0, 7).forEach(([label, amount]) => {
      y += pt(14);
      text(String(label), left + pt(12), 9, { color: INK });
      text(peso(amount), right, 9, { align: "right" });
    });
    y += pt(15);
    text("Total", left + pt(12), 9.5, { weight: 700 });
    text(peso(r.bill.total), right, 9.5, { weight: 700, align: "right" });
    rule(9);
  }
  field("Date received", r.dateText);
  field("Payment method", r.method);
  if (r.reference) field("Reference no.", r.reference);

  // The amount, large
  y += pt(34);
  text(r.amountText || "", W / 2, 26, { weight: 900, align: "center" });
  if (r.partial) {
    y += pt(20);
    text("PARTIAL PAYMENT", W / 2, 9, { weight: 800, color: "#8a4b00", align: "center", spacing: 3 });
  }
  y += pt(10);
  if (r.remarks) {
    rule(6);
    field("Remarks", r.remarks, { maxLines: 3 });
  }

  // Footer, pinned to the bottom of the page
  y = H - margin - pt(38);
  text("Thank you. Keep this receipt for your records.", W / 2, 8.5, { color: MUTED, align: "center" });
  y += pt(14);
  text(`Saved from KwartoKeeper on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, W / 2, 7.5, { color: "#9a9a9a", align: "center" });

  return canvas;
}

/**
 * Saves the receipt to the phone: the share sheet ("Save image" / Photos) where
 * the phone offers it, otherwise a normal download.
 * Resolves "shared", "downloaded" or "cancelled".
 */
export async function saveReceiptImage(r) {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts not ready: falls back to Arial */
  }
  const canvas = drawReceipt(r);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image."))), "image/png"));
  const name = `KwartoKeeper-receipt-${String(r.receiptNo || "rent").replace(/[^\w-]+/g, "")}.png`;

  // Installed Android app: browser downloads don't work inside it, so the file is
  // written to the app's storage and handed to the phone's share sheet (Save to Photos / Files)
  if (Capacitor.isNativePlatform()) {
    const data = canvas.toDataURL("image/png").split(",")[1];
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    try {
      await Share.share({ title: `Receipt ${r.receiptNo || ""}`.trim(), files: [uri], dialogTitle: "Save your receipt" });
      return "shared";
    } catch (err) {
      if (/cancel/i.test(String(err?.message || err))) return "cancelled";
      throw err;
    }
  }

  const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;

  const phoneLike = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ""));
  if (phoneLike && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Receipt ${r.receiptNo || ""}`.trim() });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
      // Share sheet refused: fall through to a download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
