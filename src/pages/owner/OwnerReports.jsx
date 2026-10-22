import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  InputAdornment,
  MenuItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import SearchIcon from "@mui/icons-material/Search";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { isReceiptable, issueMissingReceipts } from "../../utils/receipt";
import { computePriority } from "../../utils/maintenancePrioritization";
import { occupancyOf } from "../../utils/occupancy";
import { normalizePayment } from "../../utils/normalizePayment";
import { normalizeStatus, rentOf } from "../../utils/tenantRent";
import { useAuth } from "../../context/AuthContext";
import { withoutRemoved } from "../../utils/accountState";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const row = { display: "flex", alignItems: "center" };
const panelSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg, minWidth: 0 };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthIdx = (d) => d.getFullYear() * 12 + d.getMonth();

// Timestamps, Dates and strings. A plain "2026-10-05" (what the date inputs save) is read as that LOCAL day,
// not as midnight UTC, so it never slips to the day before.
const toDate = (v) => {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    const d = new Date(`${v.trim()}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = v.toDate ? v.toDate() : v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const startOfDay = (key) => new Date(`${key}T00:00:00`);
const endOfDay = (key) => new Date(`${key}T23:59:59.999`);

const fmtDate = (d) => (d ? d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");
const fmtMonth = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const peso = (n) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(Number(n) || 0);
const num = (n) => Math.round((Number(n) || 0) * 100) / 100;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "—");

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "October 2026" -> first day of that month
const periodDate = (label) => {
  const m = String(label || "").trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const i = MONTHS.findIndex((n) => n.startsWith(m[1].slice(0, 3).toLowerCase()));
  return i < 0 ? null : new Date(Number(m[2]), i, 1);
};

const tenantName = (t) => t.fullName || t.name || t.displayName || t.email || "Unnamed tenant";
const propOf = (x) => x.propertyId || x.assignedPropertyId || "";

// Same tenant status rules as the Tenants pages ("moved out", "deactivated"... are former tenants)
const tenantState = (t) => normalizeStatus(t.status).toLowerCase();

// Ticket statuses, whatever case they were saved in
const TICKET_STATUSES = ["Pending", "In Progress", "Resolved", "Cancelled"];
const ticketStatus = (s) => {
  const k = String(s || "pending").trim().toLowerCase().replace(/[_-]/g, " ");
  return TICKET_STATUSES.find((x) => x.toLowerCase() === k) || (k === "canceled" ? "Cancelled" : cap(k));
};

const propertyCapacity = (data) => {
  let rooms = 0;
  if (Array.isArray(data.rooms)) data.rooms.forEach((r) => (rooms += Number(r.capacity || r.beds || r.totalBeds || 0)));
  if (rooms > 0) return rooms;
  return Number(data.totalBeds) || Number(data.capacity) || Number(data.beds) || Number(data.totalCapacity) || 0;
};

const PRESETS = [
  { id: "month", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "3m", label: "Last 3 months" },
  { id: "year", label: "This year" },
];

const presetRange = (id) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (id === "last") return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  if (id === "3m") return { from: ymd(new Date(y, m - 2, 1)), to: ymd(new Date(y, m + 1, 0)) };
  if (id === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
};

const REPORTS = [
  { id: "all", label: "Full report", desc: "Everything in one document", Icon: AssessmentOutlinedIcon },
  { id: "payments", label: "Payments", desc: "Rent by month, property, method", Icon: PaymentsOutlinedIcon },
  { id: "journal", label: "Cash receipts", desc: "Numbered receipts, for the books", Icon: ReceiptLongOutlinedIcon },
  { id: "occupancy", label: "Occupancy", desc: "Beds filled and open today", Icon: HomeWorkOutlinedIcon },
  { id: "maintenance", label: "Maintenance", desc: "Repairs and time to fix", Icon: BuildOutlinedIcon },
  { id: "curfew", label: "Curfew", desc: "Late and out nights", Icon: NightsStayOutlinedIcon },
];

// ------------------------------------------------------------
// REPORT BUILDERS
// A report is { title, signoff, parts: [{ id, title, headline, tiles, sections }] }.
// Rows hold display text; an optional "<key>_raw" holds the plain value used for CSV.
// ------------------------------------------------------------

const sumAmount = (list) => num(list.reduce((t, p) => t + (Number(p.amount) || 0), 0));

function buildPayments({ payments, range }) {
  const fromD = startOfDay(range.from);
  const toD = endOfDay(range.to);
  const rows = payments
    .map((p) => {
      const paidOn = toDate(p.paymentDate) || toDate(p.createdAt);
      // The month the rent is FOR decides which month it belongs to (an October rent paid on Sept 30 is October's)
      const eff = periodDate(p.periodMonth) || paidOn;
      return { ...p, paidOn, eff, status: String(p.status || "").toLowerCase(), review: String(p.verificationStatus || "").toLowerCase() };
    })
    .filter((p) => p.eff && monthIdx(p.eff) >= monthIdx(fromD) && monthIdx(p.eff) <= monthIdx(toD));

  // Same rules as the Payments page: Paid and Partial are money received; a tenant's
  // upload waits for review until the owner approves or rejects it
  const isReceived = (p) => p.status === "paid" || p.status === "partial";
  const isAwaiting = (p) => p.status === "pending" || (p.review === "pending" && !["paid", "partial", "rejected", "cancelled"].includes(p.status));
  const received = rows.filter(isReceived);
  const partial = rows.filter((p) => p.status === "partial");
  const awaiting = rows.filter(isAwaiting);
  const rejected = rows.filter((p) => p.status === "rejected" || p.status === "cancelled");

  const tally = (list, keyFn, seed) => {
    const m = new Map();
    list.forEach((p) => {
      const k = keyFn(p);
      const cur = m.get(k) || { ...seed(p, k), count: 0, collected: 0, partial: 0, pending: 0 };
      const amt = Number(p.amount) || 0;
      cur.count += 1;
      if (isReceived(p)) cur.collected += amt;
      if (p.status === "partial") cur.partial += amt;
      if (isAwaiting(p)) cur.pending += amt;
      m.set(k, cur);
    });
    return [...m.values()];
  };
  const MONEY = ["collected", "partial", "pending"];
  const moneyRows = (list) =>
    list.map((g) => {
      const out = { ...g };
      MONEY.forEach((k) => {
        out[`${k}_raw`] = num(g[k]);
        out[k] = peso(g[k]);
      });
      return out;
    });
  const total = (list, keys) => {
    const t = { count: list.reduce((n, g) => n + g.count, 0) };
    keys.forEach((k) => {
      const s = num(list.reduce((a, g) => a + g[k], 0));
      t[`${k}_raw`] = s;
      t[k] = peso(s);
    });
    return t;
  };

  const monthList = tally(rows, (p) => monthIdx(p.eff), (p, k) => ({ key: k, label: fmtMonth(p.eff) })).sort((a, b) => a.key - b.key);
  const propList = tally(rows, (p) => p.propertyName || "Unassigned", (p, k) => ({ name: k })).sort((a, b) => b.collected - a.collected || a.name.localeCompare(b.name));
  const methodList = tally(received, (p) => p.paymentMethod || "Not stated", (p, k) => ({ name: k })).sort((a, b) => b.collected - a.collected || a.name.localeCompare(b.name));

  const collected = sumAmount(received);

  return {
    id: "payments",
    title: "Payments",
    headline: { label: "Rent collected", tone: collected ? "success" : undefined, value: peso(collected), raw: collected, hint: plural(received.length, "payment", "payments") },
    tiles: [
      { label: "Collected", value: peso(collected), raw: collected, tone: received.length ? "success" : undefined, hint: plural(received.length, "payment", "payments") },
      { label: "From partial payments", value: peso(sumAmount(partial)), raw: sumAmount(partial), hint: partial.length ? `${plural(partial.length, "payment", "payments")}, included above` : "None" },
      { label: "Awaiting review", value: peso(sumAmount(awaiting)), raw: sumAmount(awaiting), tone: awaiting.length ? "warning" : undefined, hint: plural(awaiting.length, "payment", "payments") },
      { label: "Records", value: String(rows.length), raw: rows.length, hint: rejected.length ? `${rejected.length} rejected or cancelled` : undefined },
    ],
    sections: [
      {
        title: "By billing month",
        note: "Grouped by the month the rent is for, not the day it was paid. Collected includes partial payments.",
        columns: [
          { key: "label", label: "Billing month" },
          { key: "count", label: "Records", align: "right" },
          { key: "collected", label: "Collected", align: "right" },
          { key: "pending", label: "Awaiting review", align: "right" },
        ],
        rows: moneyRows(monthList),
        totals: { label: "Total", ...total(monthList, ["collected", "pending"]) },
        empty: "No payments in this period.",
      },
      {
        title: "By property",
        columns: [
          { key: "name", label: "Property" },
          { key: "count", label: "Records", align: "right" },
          { key: "collected", label: "Collected", align: "right" },
          { key: "partial", label: "of which partial", align: "right" },
          { key: "pending", label: "Awaiting review", align: "right" },
        ],
        rows: moneyRows(propList),
        totals: { name: "Total", ...total(propList, ["collected", "partial", "pending"]) },
        empty: "No payments in this period.",
      },
      {
        title: "By payment method",
        note: "Money received only (Paid and Partial).",
        columns: [
          { key: "name", label: "Method" },
          { key: "count", label: "Payments", align: "right" },
          { key: "collected", label: "Collected", align: "right" },
        ],
        rows: moneyRows(methodList),
        totals: { name: "Total", ...total(methodList, ["collected"]) },
        empty: "No money received in this period.",
      },
      {
        title: "All payments",
        primary: "tenant",
        columns: [
          { key: "date", label: "Date paid" },
          { key: "tenant", label: "Tenant" },
          { key: "where", label: "Property / room" },
          { key: "period", label: "For" },
          { key: "method", label: "Method" },
          { key: "status", label: "Status", chip: true },
          { key: "amount", label: "Amount", align: "right" },
        ],
        rows: [...rows]
          .sort((a, b) => (b.paidOn?.getTime() || 0) - (a.paidOn?.getTime() || 0))
          .map((p) => ({
            date_raw: p.paidOn ? ymd(p.paidOn) : "",
            date: fmtDate(p.paidOn),
            tenant: p.tenantName || "—",
            where: `${p.propertyName || "—"}, Room ${p.roomNumber || "N/A"}`,
            period: p.periodMonth || "—",
            method: p.paymentMethod || "—",
            status: isAwaiting(p) && p.status !== "pending" ? "Pending" : cap(p.status),
            amount_raw: num(p.amount),
            amount: peso(p.amount),
          })),
        empty: "No payments in this period.",
      },
    ],
  };
}

function buildJournal({ payments, range }) {
  const fromD = startOfDay(range.from);
  const toD = endOfDay(range.to);
  const rows = payments
    .map((p) => ({ ...p, paidOn: toDate(p.paymentDate) || toDate(p.createdAt), status: String(p.status || "").toLowerCase() }))
    .filter((p) => isReceiptable(p.status) && p.paidOn && p.paidOn >= fromD && p.paidOn <= toD)
    .sort((a, b) => (a.receiptSeq ?? Infinity) - (b.receiptSeq ?? Infinity) || a.paidOn - b.paidOn);

  const total = sumAmount(rows);
  const numbered = rows.filter((p) => p.receiptNo);
  const missing = rows.length - numbered.length;
  const partials = rows.filter((p) => p.status === "partial").length;

  return {
    id: "journal",
    title: "Cash receipts journal",
    headline: { label: "Gross receipts", value: peso(total), raw: total, hint: plural(rows.length, "receipt", "receipts") },
    tiles: [
      { label: "Gross receipts", value: peso(total), raw: total },
      { label: "Receipts", value: String(rows.length), raw: rows.length, hint: partials ? `${partials} partial` : undefined },
      { label: "Receipt numbers", value: numbered.length ? `${numbered[0].receiptNo} – ${numbered[numbered.length - 1].receiptNo}` : "—" },
      { label: "Without a number", value: String(missing), raw: missing, tone: missing ? "warning" : undefined, hint: missing ? "see the notice on the page" : undefined },
    ],
    sections: [
      {
        title: "Rent received",
        primary: "tenant",
        note: "Every payment received (paid in full or partial), listed by the date the money came in. Matches Collected in the Payments report when the dates line up.",
        columns: [
          { key: "no", label: "Receipt no." },
          { key: "date", label: "Date received" },
          { key: "tenant", label: "Received from" },
          { key: "particulars", label: "Particulars" },
          { key: "method", label: "Method" },
          { key: "amount", label: "Amount", align: "right" },
        ],
        rows: rows.map((p) => ({
          no: p.receiptNo || "—",
          date_raw: p.paidOn ? ymd(p.paidOn) : "",
          date: fmtDate(p.paidOn),
          tenant: p.tenantName || "—",
          particulars: `${p.status === "partial" ? "Partial rent" : "Rent"} for ${p.periodMonth || "—"} · ${p.propertyName || "—"}, Room ${p.roomNumber || "N/A"}`,
          method: p.paymentMethod || "—",
          amount_raw: num(p.amount),
          amount: peso(p.amount),
        })),
        totals: { particulars: "Total", amount_raw: total, amount: peso(total) },
        empty: "No rent was received in this period.",
      },
    ],
  };
}

function buildOccupancy({ properties, tenants }) {
  // Same rule as the dashboard and Properties: Active and Pending tenants hold a bed
  const occ = occupancyOf(properties.map((p) => ({ id: p.id, beds: p.capacity })), tenants);
  const perProperty = properties.map((p) => {
    const o = occ.byProperty.get(p.id) || { occupied: 0, movingIn: 0, vacant: p.capacity, rate: 0 };
    return { ...p, active: o.occupied, pending: o.movingIn, vacant: o.vacant, rate: o.rate };
  });

  const beds = occ.beds;
  const active = occ.occupied;
  const pending = occ.movingIn;
  const vacant = occ.vacant;
  const rate = occ.rate;
  const current = tenants.filter((t) => tenantState(t) !== "inactive");
  const expected = num(current.filter((t) => tenantState(t) === "active").reduce((t, x) => t + rentOf(x), 0));
  const nameOf = new Map(properties.map((p) => [p.id, p.name]));

  return {
    id: "occupancy",
    title: "Occupancy",
    headline: { label: "Occupancy rate", value: `${rate}%`, raw: rate, hint: `${active} of ${beds} beds` },
    tiles: [
      { label: "Occupancy rate", value: `${rate}%`, raw: rate, hint: `${active} of ${beds} beds` },
      { label: "Occupied", value: String(active), raw: active, hint: pending ? `incl. ${pending} still moving in` : undefined },
      { label: "Vacant", value: String(vacant), raw: vacant },
      { label: "Monthly rent expected", value: peso(expected), raw: expected, hint: "from active tenants" },
    ],
    sections: [
      {
        title: "By property",
        note: "A snapshot as of today. Occupied = beds assigned to active tenants and to tenants still finishing sign-up.",
        columns: [
          { key: "name", label: "Property" },
          { key: "capacity", label: "Beds", align: "right" },
          { key: "active", label: "Occupied", align: "right" },
          { key: "vacant", label: "Vacant", align: "right" },
          { key: "pending", label: "of which moving in", align: "right" },
          { key: "rate", label: "Rate", align: "right" },
        ],
        rows: perProperty.map((p) => ({ ...p, rate_raw: p.rate, rate: `${p.rate}%` })),
        totals: { name: "Total", capacity: beds, active, vacant, pending, rate_raw: rate, rate: `${rate}%` },
        empty: "No properties yet.",
      },
      {
        title: "Current tenants",
        primary: "name",
        note: "Active tenants and those waiting to move in. Former tenants are not listed.",
        columns: [
          { key: "name", label: "Tenant" },
          { key: "property", label: "Property" },
          { key: "room", label: "Room" },
          { key: "status", label: "Status", chip: true },
          { key: "rent", label: "Monthly rent", align: "right" },
        ],
        rows: [...current]
          .sort((a, b) => tenantName(a).localeCompare(tenantName(b)))
          .map((t) => ({
            name: tenantName(t),
            property: nameOf.get(propOf(t)) || t.propertyName || "—",
            room: t.roomNumber || t.roomId || t.room || "—",
            status: cap(tenantState(t)),
            rent_raw: rentOf(t) || "",
            rent: rentOf(t) ? peso(rentOf(t)) : "—",
          })),
        empty: "No current tenants.",
      },
    ],
  };
}

function buildMaintenance({ tickets, range }) {
  const fromD = startOfDay(range.from);
  const toD = endOfDay(range.to);
  const rows = tickets
    .map((t) => ({ ...t, created: toDate(t.createdAt), resolved: toDate(t.resolvedAt), cancelled: toDate(t.cancelledAt), status: ticketStatus(t.status) }))
    .filter((t) => t.created && t.created >= fromD && t.created <= toD);

  const isOpen = (t) => t.status === "Pending" || t.status === "In Progress";
  const now = new Date();
  const open = rows.filter(isOpen);
  const resolved = rows.filter((t) => t.status === "Resolved");
  const days = (t) => (t.resolved && t.created ? Math.max((t.resolved - t.created) / 86400000, 0) : null);
  const durations = resolved.map(days).filter((d) => d !== null);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const byProperty = new Map();
  rows.forEach((t) => {
    const k = t.propertyName || "Unassigned";
    const cur = byProperty.get(k) || { name: k, total: 0, open: 0, resolved: 0 };
    cur.total += 1;
    if (isOpen(t)) cur.open += 1;
    if (t.status === "Resolved") cur.resolved += 1;
    byProperty.set(k, cur);
  });
  const propList = [...byProperty.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const extra = [...new Set(rows.map((t) => t.status))].filter((s) => !TICKET_STATUSES.includes(s));
  const statusRows = [...TICKET_STATUSES, ...extra].map((s) => ({ status: s, count: rows.filter((t) => t.status === s).length }));

  return {
    id: "maintenance",
    title: "Maintenance",
    headline: { label: "Open repair requests", tone: open.length ? "warning" : undefined, value: String(open.length), raw: open.length, hint: `${rows.length} in this period` },
    tiles: [
      { label: "Requests", value: String(rows.length), raw: rows.length },
      { label: "Still open", value: String(open.length), raw: open.length, tone: open.length ? "warning" : undefined },
      { label: "Resolved", value: String(resolved.length), raw: resolved.length, tone: resolved.length ? "success" : undefined },
      { label: "Avg. time to resolve", value: avg === null ? "—" : `${avg.toFixed(1)} days`, raw: avg === null ? "" : Number(avg.toFixed(1)) },
    ],
    sections: [
      {
        title: "By status",
        note: "Requests submitted in this period.",
        columns: [
          { key: "status", label: "Status", chip: true },
          { key: "count", label: "Requests", align: "right" },
        ],
        rows: statusRows,
        totals: { status: "Total", count: rows.length },
        empty: "No requests in this period.",
      },
      {
        title: "By property",
        columns: [
          { key: "name", label: "Property" },
          { key: "total", label: "Requests", align: "right" },
          { key: "open", label: "Open", align: "right" },
          { key: "resolved", label: "Resolved", align: "right" },
        ],
        rows: propList,
        totals: { name: "Total", total: rows.length, open: open.length, resolved: resolved.length },
        empty: "No requests in this period.",
      },
      {
        title: "All requests",
        note: "Priority comes from the request's category, the same way the Maintenance page ranks it. Days = time to resolve, or how long an open request has waited so far.",
        columns: [
          { key: "title", label: "Request" },
          { key: "tenant", label: "Tenant" },
          { key: "where", label: "Property / room" },
          { key: "priority", label: "Priority", chip: true },
          { key: "status", label: "Status", chip: true },
          { key: "submitted", label: "Submitted" },
          { key: "closed", label: "Closed" },
          { key: "days", label: "Days", align: "right" },
        ],
        rows: [...rows]
          .sort((a, b) => b.created - a.created)
          .map((t) => {
            const done = t.status === "Resolved";
            const open = isOpen(t);
            // Resolved: time it took. Open: time waiting so far. Cancelled: time until it was cancelled.
            const end = done ? t.resolved : open ? now : t.cancelled;
            const d = end && t.created ? Math.max((end - t.created) / 86400000, 0) : null;
            const closedOn = done ? t.resolved : t.status === "Cancelled" ? t.cancelled : null;
            return {
              title: t.title || "Untitled request",
              tenant: t.tenantName || "—",
              where: `${t.propertyName || "—"}, Room ${t.roomNumber || "N/A"}`,
              priority: computePriority(t).tier,
              status: t.status,
              submitted_raw: ymd(t.created),
              submitted: fmtDate(t.created),
              closed_raw: closedOn ? ymd(closedOn) : "",
              closed: closedOn ? fmtDate(closedOn) : open ? "Still open" : "—",
              days_raw: d !== null ? Number(d.toFixed(1)) : "",
              days: d !== null ? (open ? `${d.toFixed(1)} so far` : d.toFixed(1)) : "—",
            };
          }),
        empty: "No requests in this period.",
      },
    ],
  };
}

function buildCurfew({ logs, range }) {
  // Only nights with a real date inside the range (a log without a date can't be placed in any period)
  const nights = logs
    .map((l) => ({ ...l, night: String(l.date || String(l.id || "").slice(-10)).slice(0, 10) }))
    .filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.night) && l.night >= range.from && l.night <= range.to);

  const totals = { present: 0, late: 0, out: 0 };
  const perTenant = new Map();
  const flagged = [];
  let nightsLogged = 0;

  nights.forEach((l) => {
    let any = false;
    Object.entries(l.entries || {}).forEach(([tenantId, e]) => {
      if (!e || !Object.prototype.hasOwnProperty.call(totals, e.status)) return;
      any = true;
      totals[e.status] += 1;
      const cur = perTenant.get(tenantId) || { name: e.name || "Unknown", room: e.roomNumber || "—", present: 0, late: 0, out: 0 };
      cur[e.status] += 1;
      perTenant.set(tenantId, cur);
      if (e.status !== "present") flagged.push({ night: l.night, name: e.name || "Unknown", room: e.roomNumber || "—", property: l.propertyName || "—", status: e.status });
    });
    if (any) nightsLogged += 1;
  });

  const tenantList = [...perTenant.values()].sort((a, b) => b.late + b.out - (a.late + a.out) || a.name.localeCompare(b.name));
  const flaggedCount = totals.late + totals.out;

  return {
    id: "curfew",
    title: "Curfew",
    headline: { label: "Late / out nights", tone: flaggedCount ? "warning" : undefined, value: String(flaggedCount), raw: flaggedCount, hint: `${totals.late} late, ${totals.out} out` },
    tiles: [
      { label: "Nights logged", value: String(nightsLogged), raw: nightsLogged },
      { label: "In by curfew", value: String(totals.present), raw: totals.present, tone: totals.present ? "success" : undefined },
      { label: "Late", value: String(totals.late), raw: totals.late, tone: totals.late ? "warning" : undefined },
      { label: "Out past curfew", value: String(totals.out), raw: totals.out, tone: totals.out ? "error" : undefined },
    ],
    sections: [
      {
        title: "By tenant",
        note: "One check per tenant per night, as recorded by the caretaker.",
        columns: [
          { key: "name", label: "Tenant" },
          { key: "room", label: "Room" },
          { key: "present", label: "In", align: "right" },
          { key: "late", label: "Late", align: "right" },
          { key: "out", label: "Out", align: "right" },
        ],
        rows: tenantList,
        totals: { name: "Total", present: totals.present, late: totals.late, out: totals.out },
        empty: "No curfew checks in this period.",
      },
      {
        title: "Late and out nights",
        primary: "name",
        columns: [
          { key: "date", label: "Night" },
          { key: "name", label: "Tenant" },
          { key: "room", label: "Room" },
          { key: "property", label: "Property" },
          { key: "status", label: "Status", chip: true },
        ],
        rows: flagged
          .sort((a, b) => b.night.localeCompare(a.night) || a.name.localeCompare(b.name))
          .map((f) => ({
            date_raw: f.night,
            date: fmtDate(toDate(f.night)),
            name: f.name,
            room: f.room,
            property: f.property,
            status: f.status === "out" ? "Out" : "Late",
          })),
        empty: "No late or out nights in this period.",
      },
    ],
  };
}

function buildAll(args) {
  const parts = [buildPayments(args), buildJournal(args), buildOccupancy(args), buildMaintenance(args), buildCurfew(args)];
  return {
    title: "Full report",
    signoff: true,
    parts: [
      {
        id: "summary",
        title: "Summary",
        tiles: parts.map((p) => ({ ...p.headline, label: `${p.title}: ${p.headline.label}`, short: p.headline.label, partId: p.id })),
        sections: [],
      },
      ...parts,
    ],
  };
}

const wrapSingle = (part, title, signoff = false) => ({ title, signoff, parts: [part] });

// ------------------------------------------------------------
// DATA
// ------------------------------------------------------------

const EMPTY_DATA = { owner: {}, properties: [], tenants: [], payments: [], tickets: [], logs: [] };

async function fetchReportData(uid) {
  let bad = 0;
  const safe = async (q) => {
    try {
      return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Report data unavailable:", err?.code || err);
      bad += 1;
      return [];
    }
  };

  let owner = {};
  try {
    const snap = await getDoc(doc(db, "users", uid));
    owner = snap.exists() ? snap.data() : {};
  } catch (err) {
    console.warn("Owner profile unavailable:", err?.code || err);
  }

  const props = await safe(query(collection(db, "properties"), where("ownerUid", "==", uid)));
  const properties = props
    .map((p) => ({ id: p.id, name: p.propertyName || p.name || "Unnamed property", capacity: propertyCapacity(p) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [t1, u1, ownerPayments, ownerTickets, logs1, ...perProperty] = await Promise.all([
    safe(query(collection(db, "tenants"), where("ownerUid", "==", uid))),
    safe(query(collection(db, "users"), where("ownerUid", "==", uid))),
    safe(query(collection(db, "payments"), where("ownerUid", "==", uid))),
    safe(query(collection(db, "maintenance_tickets"), where("ownerUid", "==", uid))),
    safe(query(collection(db, "occupancy_logs"), where("ownerUid", "==", uid))),
    // Per-property reads recover legacy records that lack ownerUid.
    ...properties.flatMap((p) => [
      safe(query(collection(db, "tenants"), where("propertyId", "==", p.id))),
      safe(query(collection(db, "users"), where("propertyId", "==", p.id))),
      safe(query(collection(db, "occupancy_logs"), where("propertyId", "==", p.id))),
      safe(query(collection(db, "payments"), where("propertyId", "==", p.id))),
      safe(query(collection(db, "maintenance_tickets"), where("propertyId", "==", p.id))),
    ]),
  ]);

  const tenantLists = [];
  const logMap = new Map(logs1.map((l) => [l.id, l]));
  const paymentMap = new Map(ownerPayments.map((payment) => [payment.id, payment]));
  const ticketMap = new Map(ownerTickets.map((ticket) => [ticket.id, ticket]));
  for (let i = 0; i < perProperty.length; i += 5) {
    tenantLists.push(perProperty[i], perProperty[i + 1].filter((x) => !x.role || x.role === "tenant"));
    perProperty[i + 2].forEach((l) => logMap.set(l.id, l));
    perProperty[i + 3].forEach((payment) => paymentMap.set(payment.id, payment));
    perProperty[i + 4].forEach((ticket) => ticketMap.set(ticket.id, ticket));
  }

  // The same tenant can show up in several places (tenants + users): merge on uid || id
  const ownedIds = new Set(properties.map((p) => p.id));
  const byId = new Map();
  [...t1, ...u1.filter((u) => u.role === "tenant"), ...tenantLists.flat()].forEach((t) => {
    const key = t.uid || t.id;
    byId.set(key, { ...(byId.get(key) || {}), ...t });
  });
  const tenants = withoutRemoved([...byId.values()]).filter((t) => t.ownerUid === uid || ownedIds.has(propOf(t)));

  // Fill in anything an older record is missing (property, tenant name, room) from the tenant it belongs to
  const tenantsById = new Map();
  tenants.forEach((tenant) => {
    [tenant.uid, tenant.id].filter(Boolean).forEach((id) => tenantsById.set(id, tenant));
  });
  const propertiesById = new Map(properties.map((property) => [property.id, property]));
  const payments = [...paymentMap.values()].map((payment) => {
    const normalized = normalizePayment(payment);
    const tenant = tenantsById.get(normalized.tenantId);
    const paymentPropertyId = propOf(normalized) || propOf(tenant || {});
    const property = propertiesById.get(paymentPropertyId);
    return {
      // raw first: keeps fields normalizePayment doesn't know about (receiptNo, receiptSeq, receiptIssuer)
      ...payment,
      ...normalized,
      propertyId: paymentPropertyId,
      propertyName: normalized.propertyName || property?.name || tenant?.propertyName || "Unassigned",
      tenantName: normalized.tenantName || (tenant ? tenantName(tenant) : "—"),
      roomNumber: normalized.roomNumber || tenant?.roomNumber || tenant?.roomId || tenant?.room || "",
    };
  });
  const tickets = [...ticketMap.values()].map((ticket) => {
    const tenant = tenantsById.get(ticket.tenantId || ticket.tenantUid);
    const ticketPropertyId = propOf(ticket) || propOf(tenant || {});
    const property = propertiesById.get(ticketPropertyId);
    return {
      ...ticket,
      propertyId: ticketPropertyId,
      propertyName: ticket.propertyName || property?.name || tenant?.propertyName || "Unassigned",
      tenantName: ticket.tenantName || (tenant ? tenantName(tenant) : "—"),
      roomNumber: ticket.roomNumber || tenant?.roomNumber || tenant?.roomId || tenant?.room || "",
    };
  });

  return { data: { owner, properties, tenants, payments, tickets, logs: [...logMap.values()] }, failed: bad };
}

// ------------------------------------------------------------
// EXPORT — print / save as PDF, and CSV. All come from the same report object as the screen,
// so the page, the PDF and the spreadsheet always agree.
// ------------------------------------------------------------

const isWide = (report) => report.parts.some((p) => p.sections.some((s) => s.columns.length >= 7));
const TONE_HEX = { success: "#2e7d32", warning: "#c25e00", error: "#c62828", info: "#0277bd" };
const TONE_RGB = { success: [46, 125, 50], warning: [194, 94, 0], error: [198, 40, 40], info: [2, 119, 189] };
const ORANGE_HEX = "#ff4500";
const ORANGE_RGB = [255, 69, 0];

const buildPrintHtml = (report, meta) => {
  const multi = report.parts.length > 1;
  const wide = isWide(report);
  const cls = (c) => (c.align === "right" ? "r" : "");
  let partNo = 0;

  const tilesHtml = (tiles) =>
    tiles.length
      ? `<div class="tiles">${tiles
          .map(
            (t) =>
              `<div class="tile" style="border-top-color:${TONE_HEX[t.tone] || "#d9d4cc"}"><div class="tl">${escapeHtml(t.label)}</div><div class="tv"${t.tone ? ` style="color:${TONE_HEX[t.tone]}"` : ""}>${escapeHtml(t.value)}</div>${t.hint ? `<div class="th">${escapeHtml(t.hint)}</div>` : ""}</div>`
          )
          .join("")}</div>`
      : "";

  const sectionHtml = (s) => {
    const head = s.columns.map((c) => `<th class="${cls(c)}">${escapeHtml(c.label)}</th>`).join("");
    const body = s.rows.length
      ? s.rows.map((r) => `<tr>${s.columns.map((c) => `<td class="${cls(c)}">${escapeHtml(r[c.key])}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${s.columns.length}" class="empty">${escapeHtml(s.empty || "Nothing to show.")}</td></tr>`;
    const foot =
      s.totals && s.rows.length
        ? `<tfoot><tr>${s.columns.map((c) => `<td class="${cls(c)}">${escapeHtml(s.totals[c.key] ?? "")}</td>`).join("")}</tr></tfoot>`
        : "";
    const w = s.columns.length <= 3 ? 55 : s.columns.length === 4 ? 70 : s.columns.length === 5 ? 85 : 100;
    return `<section><h3>${escapeHtml(s.title)}${s.rows.length ? ` <span class="count">${s.rows.length}</span>` : ""}</h3>${s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : ""}<table class="data" style="width:${w}%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></section>`;
  };

  const partsHtml = report.parts
    .map((p, i) => {
      const isSummary = p.id === "summary";
      if (!isSummary) partNo += 1;
      const heading = multi ? `<h2 class="ph">${isSummary ? "" : `<span class="pn">${partNo}</span>`}${escapeHtml(p.title)}</h2>` : "";
      // In the full report the summary shares page 1 with the first report; every report after that starts on a new page
      return `<div class="part${multi && i > 1 ? " newpage" : ""}">${heading}${tilesHtml(p.tiles)}${p.sections.map(sectionHtml).join("")}</div>`;
    })
    .join("");

  const signoff = report.signoff
    ? `<div class="sign"><div><div class="line"></div>Prepared by<br><strong>${escapeHtml(meta.owner)}</strong></div><div><div class="line"></div>Checked / approved by</div><div><div class="line"></div>Date</div></div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)} · ${escapeHtml(meta.range)}</title><style>
    /* Page margins are built into the layout (spacer rows + side padding) instead of relying on @page margins,
       which some print dialogs ignore or reset to "None". */
    @page{size:A4 ${wide ? "landscape" : "portrait"};margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{font-family:Inter,"Segoe UI",Arial,Helvetica,sans-serif;color:#202020;font-size:11.5px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .frame{width:100%;border-collapse:collapse}
    .frame>thead{display:table-header-group}.frame>tfoot{display:table-footer-group}
    .frame>thead>tr>td,.frame>tfoot>tr>td,.frame>tbody>tr>td{padding:0;border:0;background:none}
    .sp-top{height:12mm}
    .page{padding:0 14mm}
    .runfoot{height:15mm;padding:5mm 14mm 0;display:flex;justify-content:space-between;color:#9a948c;font-size:9px}
    .top{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid #e4ddd3}
    .brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;letter-spacing:-.01em}
    .mark{display:grid;grid-template-columns:repeat(2,6px);gap:2px}
    .mark i{width:6px;height:6px;border-radius:1.5px;background:#e4ddd3;display:block}.mark i.on{background:${ORANGE_HEX}}
    .gen{color:#8a847c;font-size:10px}
    .hero{margin:16px 0 14px}
    .kicker{font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${ORANGE_HEX}}
    h1{font-size:26px;letter-spacing:-.02em;margin:2px 0 12px;line-height:1.15}
    .meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:0;background:#faf7f3;border:1px solid #ece5db;border-radius:8px}
    .meta div{padding:8px 12px;border-left:1px solid #ece5db}.meta div:first-child{border-left:0}
    .meta dt{font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:#8a847c}.meta dd{margin:2px 0 0;font-weight:700;font-size:11.5px}
    .ph{display:flex;align-items:center;gap:8px;font-size:17px;letter-spacing:-.01em;margin:22px 0 12px;padding-bottom:6px;border-bottom:2px solid #202020;break-after:avoid;page-break-after:avoid}
    .pn{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:5px;background:${ORANGE_HEX};color:#fff;font-size:11px}
    .newpage{break-before:page;page-break-before:always}
    .newpage .ph{margin-top:0}
    .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:6px}
    .tile{background:#faf7f3;border:1px solid #ece5db;border-top:3px solid #d9d4cc;border-radius:6px;padding:8px 10px;break-inside:avoid}
    .tl{font-size:8.5px;color:#7a746c;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
    .tv{font-size:17px;font-weight:800;letter-spacing:-.01em;margin-top:3px;font-variant-numeric:tabular-nums}.th{font-size:9px;color:#8a847c;margin-top:1px}
    section{margin-top:18px}
    h3{font-size:12.5px;margin:0 0 2px;break-after:avoid;page-break-after:avoid;display:flex;align-items:center;gap:6px}
    .count{font-size:9px;font-weight:700;color:#7a746c;background:#f0ebe4;border-radius:99px;padding:1px 6px}
    .note{color:#8a847c;font-size:9.5px;margin:0 0 6px}
    table.data{border-collapse:collapse;font-variant-numeric:tabular-nums}
    table.data thead{display:table-header-group}
    table.data tfoot{display:table-row-group}
    table.data th{background:#202020;color:#fff;text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
    table.data th,table.data td{padding:5px 8px;vertical-align:top}
    table.data td{border-bottom:1px solid #ece5db}
    table.data tbody tr:nth-child(even) td{background:#faf7f3}
    table.data tr{break-inside:avoid;page-break-inside:avoid}
    table.data tfoot td{border-top:1.5px solid #202020;border-bottom:1.5px solid #202020;font-weight:800;background:#f3ede5}
    .r{text-align:right;white-space:nowrap}.empty{color:#8a847c;text-align:center;padding:14px}
    .sign{display:flex;gap:28px;margin-top:44px;break-inside:avoid;page-break-inside:avoid}
    .sign>div{flex:1;font-size:10px;color:#5c574f}.line{border-bottom:1px solid #202020;height:30px;margin-bottom:4px}
    .end{margin-top:22px;color:#9a948c;font-size:9px}
  </style></head><body>
  <table class="frame"><thead><tr><td><div class="sp-top"></div></td></tr></thead><tbody><tr><td><div class="page">
    <div class="top"><span class="brand"><span class="mark"><i class="on"></i><i></i><i class="on"></i><i class="on"></i></span>KwartoKeeper</span><span class="gen">Generated ${escapeHtml(meta.generated)}</span></div>
    <div class="hero">
      <div class="kicker">Report</div>
      <h1>${escapeHtml(report.title)}</h1>
      <dl class="meta">
        <div><dt>Period</dt><dd>${escapeHtml(meta.range)}</dd></div>
        <div><dt>Property</dt><dd>${escapeHtml(meta.property)}</dd></div>
        <div><dt>Prepared by</dt><dd>${escapeHtml(meta.owner)}</dd></div>
        <div><dt>Generated</dt><dd>${escapeHtml(meta.generated)}</dd></div>
      </dl>
    </div>
    ${partsHtml}${signoff}
    <div class="end">Figures are taken from the records in KwartoKeeper at the time this report was generated.</div>
  </div></td></tr></tbody><tfoot><tr><td><div class="runfoot"><span>KwartoKeeper · ${escapeHtml(report.title)}</span><span>${escapeHtml(meta.range)} · ${escapeHtml(meta.property)}</span></div></td></tr></tfoot></table>
  </body></html>`;
};

const printReport = (report, meta) => {
  const html = buildPrintHtml(report, meta);
  // iPhone/iPad print the parent page instead of a hidden frame, so they get a new tab
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
      return;
    }
  }
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = () => setTimeout(() => iframe.remove(), 500);
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 60000); // in case afterprint never fires
  }, 250);
};

// Save a real PDF file (no print dialog), laid out like the printed version
const savePdf = async (report, meta, filename) => {
  const [{ jsPDF }, tableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = tableModule.default || tableModule.autoTable;

  const multi = report.parts.length > 1;
  const wide = isWide(report);
  const pdf = new jsPDF({ orientation: wide ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = { left: 40, right: 40, top: 54, bottom: 56 };
  const contentW = W - M.left - M.right;
  // The built-in PDF fonts have no peso sign, so it is written as "PHP"
  const t = (v) => String(v ?? "").replace(/₱/g, "PHP ").replace(/–/g, "-").replace(/\s+/g, " ").trim();
  const INK = [32, 32, 32];
  const GRAY = [128, 122, 114];
  const LINE = [236, 229, 219];
  const CREAM = [250, 247, 243];
  let y = 40;

  const ensure = (need) => {
    if (y + need > H - M.bottom) {
      pdf.addPage();
      y = M.top;
    }
  };

  const mark = (x, top, s = 6, g = 2) => {
    [[1, 0], [0, 0], [1, 1], [1, 1]].forEach(([on], i) => {
      pdf.setFillColor(...(on ? ORANGE_RGB : LINE));
      pdf.roundedRect(x + (i % 2) * (s + g), top + Math.floor(i / 2) * (s + g), s, s, 1.2, 1.2, "F");
    });
  };

  // Header
  mark(M.left, y - 9);
  pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK).text("KwartoKeeper", M.left + 20, y);
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY).text(`Generated ${t(meta.generated)}`, W - M.right, y, { align: "right" });
  pdf.setDrawColor(...LINE).setLineWidth(0.8).line(M.left, y + 10, W - M.right, y + 10);
  y += 34;
  pdf.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...ORANGE_RGB).text("REPORT", M.left, y);
  y += 20;
  pdf.setFont("helvetica", "bold").setFontSize(22).setTextColor(...INK).text(t(report.title), M.left, y);
  y += 14;

  // Meta strip
  const metaItems = [["Period", meta.range], ["Property", meta.property], ["Prepared by", meta.owner], ["Generated", meta.generated]];
  const metaW = contentW / metaItems.length;
  pdf.setFillColor(...CREAM).setDrawColor(...LINE).setLineWidth(0.7).roundedRect(M.left, y, contentW, 38, 5, 5, "FD");
  metaItems.forEach(([label, value], i) => {
    const x = M.left + i * metaW;
    if (i) pdf.setDrawColor(...LINE).line(x, y + 6, x, y + 32);
    pdf.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...GRAY).text(label.toUpperCase(), x + 10, y + 14);
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK).text(t(value), x + 10, y + 27, { maxWidth: metaW - 16 });
  });
  y += 56;

  const drawTiles = (tiles) => {
    if (!tiles.length) return;
    const gap = 8;
    const cols = Math.min(tiles.length, wide ? 5 : 4);
    const boxW = (contentW - gap * (cols - 1)) / cols;
    const boxH = 52;
    tiles.forEach((tile, i) => {
      const col = i % cols;
      if (col === 0) ensure(boxH + gap);
      const x = M.left + col * (boxW + gap);
      const tone = TONE_RGB[tile.tone];
      pdf.setFillColor(...CREAM).setDrawColor(...LINE).setLineWidth(0.7).roundedRect(x, y, boxW, boxH, 4, 4, "FD");
      pdf.setFillColor(...(tone || [217, 212, 204])).rect(x + 0.5, y + 0.5, boxW - 1, 2.5, "F");
      pdf.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...GRAY).text(t(tile.short || tile.label).toUpperCase(), x + 8, y + 15, { maxWidth: boxW - 16 });
      pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(...(tone || INK)).text(t(tile.value), x + 8, y + 32, { maxWidth: boxW - 16 });
      if (tile.hint) pdf.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...GRAY).text(t(tile.hint), x + 8, y + 44, { maxWidth: boxW - 16 });
      if (col === cols - 1 || i === tiles.length - 1) y += boxH + gap;
    });
  };

  let partNo = 0;
  report.parts.forEach((part, i) => {
    if (multi && i > 1) {
      pdf.addPage();
      y = M.top;
    }
    if (multi) {
      ensure(44);
      const isSummary = part.id === "summary";
      let x = M.left;
      if (!isSummary) {
        partNo += 1;
        pdf.setFillColor(...ORANGE_RGB).roundedRect(x, y - 8, 16, 16, 3, 3, "F");
        pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255).text(String(partNo), x + 8, y + 3.2, { align: "center" });
        x += 24;
      }
      pdf.setFont("helvetica", "bold").setFontSize(14).setTextColor(...INK).text(t(part.title), x, y + 4.5);
      pdf.setDrawColor(...INK).setLineWidth(1.4).line(M.left, y + 14, W - M.right, y + 14);
      y += 30;
    }
    drawTiles(part.tiles);

    part.sections.forEach((s) => {
      ensure(80);
      y += 6;
      pdf.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...INK).text(t(s.title), M.left, y + 4);
      y += 14;
      if (s.note) {
        const lines = pdf.setFont("helvetica", "normal").setFontSize(7.8).setTextColor(...GRAY).splitTextToSize(t(s.note), contentW);
        pdf.text(lines, M.left, y + 2);
        y += 10 * lines.length;
      }
      const w = s.columns.length <= 3 ? 0.55 : s.columns.length === 4 ? 0.7 : s.columns.length === 5 ? 0.85 : 1;
      const columnStyles = {};
      s.columns.forEach((c, ci) => {
        if (c.align === "right") columnStyles[ci] = { halign: "right", cellWidth: "wrap" };
      });
      autoTable(pdf, {
        startY: y + 2,
        margin: { top: M.top, left: M.left, right: M.right, bottom: M.bottom },
        tableWidth: contentW * w,
        head: [s.columns.map((c) => ({ content: t(c.label).toUpperCase(), styles: { halign: c.align === "right" ? "right" : "left" } }))],
        body: s.rows.length
          ? s.rows.map((r) => s.columns.map((c) => t(r[c.key])))
          : [[{ content: t(s.empty || "Nothing to show."), colSpan: s.columns.length, styles: { halign: "center", textColor: GRAY } }]],
        foot: s.totals && s.rows.length ? [s.columns.map((c, ci) => ({ content: t(s.totals[c.key] ?? ""), styles: { halign: c.align === "right" ? "right" : "left" }, ci }))] : undefined,
        showHead: "everyPage",
        showFoot: "lastPage",
        theme: "plain",
        styles: { font: "helvetica", fontSize: 8.3, cellPadding: { top: 4, bottom: 4, left: 6, right: 6 }, textColor: INK, overflow: "linebreak", lineColor: LINE, lineWidth: { bottom: 0.6 } },
        headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.8, lineWidth: 0 },
        footStyles: { fillColor: [243, 237, 229], fontStyle: "bold", textColor: INK, lineColor: INK, lineWidth: { top: 1.1, bottom: 1.1 } },
        alternateRowStyles: { fillColor: CREAM },
        columnStyles,
      });
      y = pdf.lastAutoTable.finalY + 18;
    });
  });

  if (report.signoff) {
    ensure(110);
    y += 24;
    const colW = (contentW - 40) / 3;
    ["Prepared by", "Checked / approved by", "Date"].forEach((label, i) => {
      const x = M.left + i * (colW + 20);
      pdf.setDrawColor(...INK).setLineWidth(0.8).line(x, y + 24, x + colW, y + 24);
      pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY).text(label, x, y + 36);
      if (i === 0) pdf.setFont("helvetica", "bold").setTextColor(...INK).text(t(meta.owner), x, y + 48);
    });
  }

  // Running header (from page 2) and footer on every page
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    pdf.setPage(p);
    if (p > 1) {
      mark(M.left, 24, 4, 1.5);
      pdf.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...GRAY).text(t(report.title), M.left + 14, 31);
      pdf.setFont("helvetica", "normal").text(t(`${meta.range} · ${meta.property}`), W - M.right, 31, { align: "right" });
    }
    pdf.setDrawColor(...LINE).setLineWidth(0.6).line(M.left, H - 36, W - M.right, H - 36);
    pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRAY);
    pdf.text(`KwartoKeeper · ${t(report.title)}`, M.left, H - 24);
    pdf.text(`Page ${p} of ${pages}`, W - M.right, H - 24, { align: "right" });
  }

  pdf.save(filename);
};

// CSV cells: numbers stay numbers (so Excel can sum them); text that could be read as a formula is defused
const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvLine = (cells) => cells.map(csvCell).join(",");
const rawOr = (obj, key) => (obj && obj[`${key}_raw`] !== undefined ? obj[`${key}_raw`] : obj?.[key]);

const buildCsv = (report, meta) => {
  const multi = report.parts.length > 1;
  const lines = [
    csvLine(["Report", report.title]),
    csvLine(["Period", meta.range]),
    csvLine(["Property", meta.property]),
    csvLine(["Prepared by", meta.owner]),
    csvLine(["Generated", meta.generated]),
  ];
  report.parts.forEach((part) => {
    lines.push("");
    if (multi) lines.push(csvLine(["PART", part.title.toUpperCase()]));
    if (part.tiles.length) {
      lines.push(csvLine(["Summary"]), csvLine(["Item", "Value", "Note"]));
      part.tiles.forEach((tile) => lines.push(csvLine([tile.label, tile.raw !== undefined ? tile.raw : tile.value, tile.hint || ""])));
    }
    part.sections.forEach((s) => {
      lines.push("", csvLine([s.title]));
      if (s.note) lines.push(csvLine([s.note]));
      lines.push(csvLine(s.columns.map((c) => c.label)));
      if (!s.rows.length) lines.push(csvLine([s.empty || "Nothing to show."]));
      s.rows.forEach((r) => lines.push(csvLine(s.columns.map((c) => rawOr(r, c.key)))));
      if (s.totals && s.rows.length) lines.push(csvLine(s.columns.map((c) => rawOr(s.totals, c.key) ?? "")));
    });
  });
  return `\uFEFF${lines.join("\r\n")}\r\n`; // BOM so Excel reads ₱ and accents correctly
};

const downloadCsv = (text, filename) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ------------------------------------------------------------
// ON-SCREEN PIECES
// ------------------------------------------------------------

const TILE_GRID = { display: "grid", gap: { xs: 1, sm: 1.5 }, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(auto-fit, minmax(170px, 1fr))" } };

const STATUS_TONES = {
  paid: "success", active: "success", resolved: "success", approved: "success", low: "success",
  pending: "warning", partial: "warning", late: "warning", medium: "warning",
  "in progress": "info",
  overdue: "error", rejected: "error", out: "error", high: "error", urgent: "error",
};
const statusTone = (text) => STATUS_TONES[String(text || "").trim().toLowerCase()] || "default";

function StatusPill({ text }) {
  if (!text || text === "—") return <>{text || "—"}</>;
  const tone = statusTone(text);
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        height: 22,
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.06) : alpha(t.palette[tone].main, 0.12)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    >
      {text}
    </Box>
  );
}

function Tile({ label, value, hint, tone, onClick }) {
  const inner = (
    <>
      <Box sx={{ ...row, gap: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "2px", flexShrink: 0, bgcolor: tone ? `${tone}.main` : (t) => alpha(t.palette.text.primary, 0.15) }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, minWidth: 0, flex: 1 }} noWrap>
          {label}
        </Typography>
        {onClick && <ChevronRightIcon sx={{ fontSize: 18, color: "text.disabled", mr: -0.5 }} />}
      </Box>
      <Typography sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.1rem", sm: "1.35rem" }, lineHeight: 1.25, mt: 0.5, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums", color: tone ? `${tone}.dark` : "text.primary" }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.35, mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </>
  );
  const sx = { minWidth: 0, p: { xs: 1.5, sm: 1.75 }, borderRadius: R.md, textAlign: "left", border: 0, font: "inherit", color: "inherit", bgcolor: (th) => alpha(th.palette.background.paper, 0.55) };
  return onClick ? (
    <Box component="button" type="button" onClick={onClick} sx={{ ...sx, cursor: "pointer", "&:hover": { bgcolor: (th) => alpha(th.palette.background.paper, 0.9) } }}>
      {inner}
    </Box>
  ) : (
    <Box sx={sx}>{inner}</Box>
  );
}

const SCREEN_ROWS = 50;

function ReportTable({ section }) {
  const isPhone = useMediaQuery((t) => t.breakpoints.down("sm"));
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");

  const searchable = section.rows.length > 12;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return section.rows;
    return section.rows.filter((r) => section.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(term)));
  }, [q, section]);

  const hidden = !showAll && filtered.length > SCREEN_ROWS ? filtered.length - SCREEN_ROWS : 0;
  const visible = hidden ? filtered.slice(0, SCREEN_ROWS) : filtered;
  const cell = (r, c) => (c.chip ? <StatusPill text={r[c.key]} /> : r[c.key]);

  // Phones: wide tables read badly, so each row becomes a small card
  const asCards = isPhone && section.columns.length >= 4;
  const primary = section.columns.find((c) => c.key === section.primary) || section.columns[0];
  const amount = section.columns.length > 2 && section.columns[section.columns.length - 1].align === "right" ? section.columns[section.columns.length - 1] : null;
  const details = section.columns.filter((c) => c !== primary && c !== amount);

  return (
    <Box sx={{ ...panelSx, overflow: "hidden" }}>
      <Box sx={{ px: { xs: 1.75, sm: 2.25 }, pt: 1.75, pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1rem" }}>{section.title}</Typography>
          {section.rows.length > 0 && (
            <Box component="span" sx={{ px: 0.85, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: 11.5, fontWeight: 700, color: "text.secondary", bgcolor: (t) => alpha(t.palette.text.primary, 0.06) }}>
              {section.rows.length}
            </Box>
          )}
          {searchable && (
            <TextField
              size="small"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search this list"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { "aria-label": `Search ${section.title}` },
              }}
              sx={{ ml: { sm: "auto" }, width: { xs: 1, sm: 240 }, "& .MuiOutlinedInput-root": { borderRadius: R.sm } }}
            />
          )}
        </Box>
        {section.note && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.45 }}>
            {section.note}
          </Typography>
        )}
      </Box>

      {section.rows.length === 0 || filtered.length === 0 ? (
        <Box sx={{ py: 4, px: 2, textAlign: "center", color: "text.secondary", borderTop: "1px solid", borderColor: "divider" }}>
          <InboxOutlinedIcon sx={{ fontSize: 28, opacity: 0.45 }} />
          <Typography variant="body2">{section.rows.length === 0 ? section.empty || "Nothing to show." : "No matches."}</Typography>
        </Box>
      ) : asCards ? (
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
          {visible.map((r, i) => (
            <Box key={i} sx={{ px: 1.75, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, alignItems: "baseline" }}>
                <Typography sx={{ fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }} component="div">
                  {cell(r, primary)}
                </Typography>
                {amount && (
                  <Typography sx={{ fontWeight: 800, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }} component="div">
                    {cell(r, amount)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ mt: 0.75, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1.5, rowGap: 0.4, alignItems: "center" }}>
                {details
                  .filter((c) => r[c.key] !== undefined && r[c.key] !== "" && r[c.key] !== "—")
                  .map((c) => (
                    <Fragment key={c.key}>
                      <Typography variant="caption" color="text.secondary">
                        {c.label}
                      </Typography>
                      <Typography variant="body2" component="div" sx={{ overflowWrap: "anywhere" }}>
                        {cell(r, c)}
                      </Typography>
                    </Fragment>
                  ))}
              </Box>
            </Box>
          ))}
          {section.totals && !q && (
            <Box sx={{ px: 1.75, py: 1.5, bgcolor: (t) => alpha(t.palette.background.paper, 0.6), display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1.5, rowGap: 0.25 }}>
              {section.columns
                .filter((c) => section.totals[c.key] !== undefined && section.totals[c.key] !== "")
                .map((c, i) => (
                  <Fragment key={c.key}>
                    {i > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {c.label}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={i === 0 ? { fontWeight: 800, gridColumn: "1 / -1" } : { fontWeight: 800, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {section.totals[c.key]}
                    </Typography>
                  </Fragment>
                ))}
            </Box>
          )}
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 460, borderTop: "1px solid", borderColor: "divider" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {section.columns.map((c) => (
                  <TableCell
                    key={c.key}
                    align={c.align || "left"}
                    sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", bgcolor: "background.paper", py: 1.1 }}
                  >
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r, i) => (
                <TableRow key={i} hover>
                  {section.columns.map((c) => (
                    <TableCell key={c.key} align={c.align || "left"} sx={{ whiteSpace: c.align === "right" || c.chip ? "nowrap" : "normal", fontVariantNumeric: c.align === "right" ? "tabular-nums" : undefined }}>
                      {cell(r, c)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {section.totals && !q && (
                <TableRow>
                  {section.columns.map((c) => (
                    <TableCell
                      key={c.key}
                      align={c.align || "left"}
                      sx={{ fontWeight: 800, whiteSpace: "nowrap", borderTop: "2px solid", borderTopColor: "text.primary", bgcolor: (t) => alpha(t.palette.background.paper, 0.6), fontVariantNumeric: "tabular-nums", position: "sticky", bottom: 0 }}
                    >
                      {section.totals[c.key] ?? ""}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {(hidden > 0 || (q && filtered.length > 0)) && (
        <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary">
            {q ? `${filtered.length} of ${section.rows.length} match. ` : `Showing ${SCREEN_ROWS} of ${filtered.length}. `}
            The PDF and CSV always include everything.
          </Typography>
          {hidden > 0 && (
            <Button size="small" onClick={() => setShowAll(true)} sx={{ fontWeight: 700 }}>
              Show all
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

// One report inside the full report. The summary is always open; the reports
// after it start closed and open with a tap, showing their key figure meanwhile.
function PartView({ part, number, showHeading, onJump, open, onToggle }) {
  const collapsible = showHeading && part.id !== "summary";
  const isOpen = !collapsible || open;
  const headline = part.headline;
  return (
    <Box id={`part-${part.id}`} sx={{ scrollMarginTop: { xs: 72, md: 96 } }}>
      {showHeading && !collapsible && (
        <Box sx={{ ...row, gap: 1.25, pb: 1, mb: 1.75, borderBottom: "2px solid", borderColor: "text.primary" }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.01em", flex: 1 }}>{part.title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
            Tap a figure or a report below to see its details
          </Typography>
        </Box>
      )}
      {collapsible && (
        <Box
          component="button"
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`part-body-${part.id}`}
          sx={{
            ...row,
            width: "100%",
            gap: 1.5,
            p: { xs: 1.5, sm: 2 },
            mb: isOpen ? 1.75 : 0,
            font: "inherit",
            textAlign: "left",
            cursor: "pointer",
            color: "text.primary",
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: isOpen ? "text.primary" : "divider",
            borderRadius: R.lg,
            transition: "border-color .15s, background-color .15s",
            "&:hover": { borderColor: isOpen ? "text.primary" : (t) => alpha(t.palette.text.primary, 0.35), bgcolor: (t) => alpha(t.palette.background.paper, 0.3) },
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
          }}
        >
          <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "grid", placeItems: "center", bgcolor: "primary.main", color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{number}</Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.15rem" }, letterSpacing: "-0.01em", lineHeight: 1.25 }}>{part.title}</Typography>
            <Typography variant="caption" color="text.secondary" component="div" noWrap>
              {isOpen ? `${part.sections.length} ${part.sections.length === 1 ? "table" : "tables"} · tap to hide` : "Tap to show the details"}
            </Typography>
          </Box>
          {headline && (
            <Box sx={{ textAlign: "right", minWidth: 0, flexShrink: 1, display: { xs: isOpen ? "none" : "block", sm: "block" } }}>
              <Typography variant="caption" color="text.secondary" noWrap component="div">{headline.label}</Typography>
              <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.05rem", fontVariantNumeric: "tabular-nums", color: headline.tone ? `${headline.tone}.dark` : "text.primary" }}>
                {headline.value}
              </Typography>
            </Box>
          )}
          <ExpandMoreIcon sx={{ flexShrink: 0, color: "text.secondary", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </Box>
      )}
      <Collapse in={isOpen} unmountOnExit={false} id={`part-body-${part.id}`}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
          {part.tiles.length > 0 && (
            <Box sx={{ ...panelSx, p: { xs: 1, sm: 1.25 } }}>
              <Box sx={TILE_GRID}>
                {part.tiles.map((t) => (
                  <Tile key={t.label} label={t.label} value={t.value} hint={t.hint} tone={t.tone} onClick={t.partId && onJump ? () => onJump(t.partId) : undefined} />
                ))}
              </Box>
            </Box>
          )}
          {part.sections.map((s) => (
            <ReportTable key={s.title} section={s} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function OwnerReports() {
  const { currentUser } = useAuth() || {};
  const uid = currentUser?.uid;

  // Each Refresh bumps the key; the page is loading until data for that key arrives
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: -1, data: EMPTY_DATA, failed: 0, loadedAt: null });
  const [numbering, setNumbering] = useState(false);
  const [numberMsg, setNumberMsg] = useState("");
  const [savingPdf, setSavingPdf] = useState(false);
  const [exportError, setExportError] = useState("");

  const [tab, setTab] = useState("all");
  const [propertyId, setPropertyId] = useState("all");
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(() => presetRange("month"));

  const loading = Boolean(uid) && result.key !== reloadKey;
  const { data, failed, loadedAt } = result;

  useEffect(() => {
    if (!uid) return undefined;
    let active = true;
    fetchReportData(uid)
      .then(({ data: next, failed: bad }) => {
        if (active) setResult({ key: reloadKey, data: next, failed: bad, loadedAt: new Date() });
      })
      .catch((err) => {
        console.error("Couldn't load report data:", err);
        if (active) setResult((r) => ({ ...r, key: reloadKey, failed: Math.max(r.failed, 1), loadedAt: new Date() }));
      });
    return () => {
      active = false;
    };
  }, [uid, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const pickPreset = (id) => {
    setPreset(id);
    setRange(presetRange(id));
  };

  const setDate = (key) => (e) => {
    setPreset("");
    setRange((r) => ({ ...r, [key]: e.target.value }));
  };

  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);
  // A property that was deleted since it was picked falls back to all properties
  const selectedProperty = data.properties.find((p) => p.id === propertyId);
  const activePropertyId = selectedProperty ? propertyId : "all";

  const report = useMemo(() => {
    if (loading) return null;
    // Anything that belongs to the chosen property (older records may only carry the property name)
    const inProperty = (x) =>
      activePropertyId === "all" || propOf(x) === activePropertyId || (!propOf(x) && Boolean(selectedProperty) && x.propertyName === selectedProperty.name);
    const args = {
      range,
      payments: data.payments.filter(inProperty),
      tickets: data.tickets.filter(inProperty),
      logs: data.logs.filter(inProperty),
      tenants: data.tenants.filter(inProperty),
      properties: activePropertyId === "all" ? data.properties : data.properties.filter((p) => p.id === activePropertyId),
    };

    if (tab === "occupancy") return wrapSingle(buildOccupancy(args), "Occupancy report");
    if (!rangeValid) return null;
    if (tab === "all") return buildAll(args);
    if (tab === "journal") return wrapSingle(buildJournal(args), "Cash receipts journal", true);
    if (tab === "maintenance") return wrapSingle(buildMaintenance(args), "Maintenance report");
    if (tab === "curfew") return wrapSingle(buildCurfew(args), "Curfew report");
    return wrapSingle(buildPayments(args), "Payments report", true);
  }, [loading, data, tab, activePropertyId, range, rangeValid, selectedProperty]);

  const needsDates = tab !== "occupancy";
  const rangeLabel = needsDates ? `${fmtDate(toDate(range.from))} to ${fmtDate(toDate(range.to))}` : `As of ${fmtDate(new Date())}`;
  const propertyLabel = selectedProperty ? selectedProperty.name : "All properties";

  const owner = data.owner || {};
  const ownerName = owner.fullName || owner.name || currentUser?.displayName || currentUser?.email || "Owner";

  // Only this property's payments when one is picked, so the count matches what's on screen
  const unnumbered = useMemo(
    () =>
      data.payments.filter(
        (p) => isReceiptable(p.status) && !p.receiptNo && (activePropertyId === "all" || propOf(p) === activePropertyId)
      ),
    [data.payments, activePropertyId]
  );

  const assignNumbers = async () => {
    setNumbering(true);
    setNumberMsg("");
    try {
      const when = (p) => (toDate(p.paymentDate) || toDate(p.createdAt) || new Date(0)).getTime();
      const n = await issueMissingReceipts(db, uid, [...unnumbered].sort((a, b) => when(a) - when(b)));
      setNumberMsg(`Numbered ${plural(n, "payment", "payments")}.`);
    } catch (err) {
      console.error("Could not assign receipt numbers:", err);
      setNumberMsg("Couldn't assign every number. Refresh and try again.");
    } finally {
      setNumbering(false);
      refresh();
    }
  };

  const exportMeta = () => ({
    owner: ownerName,
    property: propertyLabel,
    range: rangeLabel,
    generated: new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }),
  });

  const handlePrint = () => {
    if (report) printReport(report, exportMeta());
  };

  const fileStamp = () => (needsDates ? `${range.from}_to_${range.to}` : ymd(new Date()));
  const fileName = (ext) => `kwartokeeper_${tab}_${selectedProperty ? `${selectedProperty.name.replace(/[^\w-]+/g, "-").toLowerCase()}_` : ""}${fileStamp()}.${ext}`;

  const handleCsv = () => {
    if (report) downloadCsv(buildCsv(report, exportMeta()), fileName("csv"));
  };

  const handleSavePdf = async () => {
    if (!report || savingPdf) return;
    setSavingPdf(true);
    setExportError("");
    try {
      await savePdf(report, exportMeta(), fileName("pdf"));
    } catch (err) {
      console.error("Could not save the PDF:", err);
      setExportError("Couldn't save the PDF. If this keeps happening, use Print and choose \"Save as PDF\".");
    } finally {
      setSavingPdf(false);
    }
  };

  // Reports after the summary start closed; jumping to one opens it first
  const [openParts, setOpenParts] = useState({});
  const togglePart = (id) => setOpenParts((o) => ({ ...o, [id]: !o[id] }));
  const setAllParts = (value) => setOpenParts(Object.fromEntries((report?.parts || []).map((p) => [p.id, value])));
  const jumpTo = (id) => {
    setOpenParts((o) => ({ ...o, [id]: true }));
    setTimeout(() => document.getElementById(`part-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const showNumberNotice = !loading && (tab === "journal" || tab === "all");
  const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: R.sm } };
  const multi = report && report.parts.length > 1;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* ───── Header: pick the report, the property and the period ───── */}
      <Box component="section" sx={{ ...panelSx, position: "relative", overflow: "hidden", borderRadius: R.xl, p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />

        <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography color="text.secondary" sx={{ fontSize: { xs: 14, sm: 15 } }}>
              Pick a report and a period, then save it as a PDF, print it or download a CSV
            </Typography>
            {loadedAt && (
              <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.8 }}>
                Data as of {loadedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            color="inherit"
            onClick={refresh}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            sx={{ flexShrink: 0, fontWeight: 700, borderRadius: R.sm, borderColor: "divider", bgcolor: "background.default", minWidth: { xs: 0, sm: 64 }, px: { xs: 1.25, sm: 2 }, "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } } }}
            aria-label="Refresh data"
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Refresh</Box>
          </Button>
        </Box>

        {/* Report picker: a scrolling row on phones, a grid from tablets up */}
        <Box
          role="tablist"
          aria-label="Report"
          sx={{
            position: "relative",
            display: { xs: "flex", sm: "grid" },
            gridTemplateColumns: { sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" },
            gap: 1,
            overflowX: { xs: "auto", sm: "visible" },
            mx: { xs: -2, sm: 0 },
            px: { xs: 2, sm: 0 },
            pb: { xs: 0.5, sm: 0 },
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {REPORTS.map(({ id, label, desc, Icon }) => {
            const active = tab === id;
            return (
              <Box
                key={id}
                component="button"
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                sx={{
                  flex: { xs: "0 0 152px", sm: "initial" },
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 0.75,
                  p: 1.5,
                  textAlign: "left",
                  font: "inherit",
                  cursor: "pointer",
                  borderRadius: R.md,
                  border: "1px solid",
                  borderColor: active ? "primary.main" : "transparent",
                  bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.07) : alpha(t.palette.background.paper, 0.55)),
                  color: "text.primary",
                  transition: "background-color .15s, border-color .15s",
                  "&:hover": { bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.1) : alpha(t.palette.background.paper, 0.9)) },
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                }}
              >
                <Box sx={{ width: 32, height: 32, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: active ? "primary.main" : "#fff", color: active ? "#fff" : "primary.main" }}>
                  <Icon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ minWidth: 0, width: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3 }} noWrap>{label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.35 }}>{desc}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Filters */}
        <Box sx={{ position: "relative", mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: needsDates ? "minmax(0, 1.4fr) repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", md: needsDates ? "minmax(0, 1.4fr) repeat(2, minmax(0, 1fr))" : "minmax(0, 0.5fr)" } }}>
            <TextField select size="small" label="Property" value={activePropertyId} onChange={(e) => setPropertyId(e.target.value)} fullWidth sx={fieldSx}>
              <MenuItem value="all">All properties</MenuItem>
              {data.properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            {needsDates && (
              <Box sx={{ display: "contents", "@media (max-width:599.95px)": { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 } }}>
                <TextField label="From" type="date" size="small" value={range.from} onChange={setDate("from")} slotProps={{ inputLabel: { shrink: true } }} error={!rangeValid} fullWidth sx={fieldSx} />
                <TextField label="To" type="date" size="small" value={range.to} onChange={setDate("to")} slotProps={{ inputLabel: { shrink: true } }} error={!rangeValid} fullWidth sx={fieldSx} />
              </Box>
            )}
          </Box>

          {needsDates ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 1.5 }}>
              {PRESETS.map((p) => {
                const active = preset === p.id;
                return (
                  <Box
                    key={p.id}
                    component="button"
                    type="button"
                    onClick={() => pickPreset(p.id)}
                    aria-pressed={active}
                    sx={{
                      height: 32,
                      px: 1.5,
                      borderRadius: 99,
                      font: "inherit",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: active ? "text.primary" : "divider",
                      bgcolor: active ? "text.primary" : "background.default",
                      color: active ? "background.default" : "text.secondary",
                    }}
                  >
                    {p.label}
                  </Box>
                );
              })}
              {!rangeValid && (
                <Typography variant="caption" color="error" sx={{ fontWeight: 600, ml: 0.5 }}>
                  The end date must be on or after the start date.
                </Typography>
              )}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
              Occupancy is a snapshot of today, so it doesn't use dates.
            </Typography>
          )}
          {tab === "all" && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              The full report puts every report in one document. Occupancy always shows today.
            </Typography>
          )}
        </Box>
      </Box>

      {showNumberNotice && (unnumbered.length > 0 || numberMsg) && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2.5 }}>
          {unnumbered.length > 0 && (
            <Alert
              severity="warning"
              sx={{ borderRadius: R.md, alignItems: "center" }}
              action={
                <Button size="small" color="inherit" onClick={assignNumbers} disabled={numbering} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {numbering ? "Numbering…" : "Assign numbers"}
                </Button>
              }
            >
              {plural(unnumbered.length, "received payment has", "received payments have")} no receipt number yet. Assigning numbers them oldest first, continuing from your next receipt number.
            </Alert>
          )}
          {numberMsg && (
            <Alert severity={numberMsg.startsWith("Couldn't") ? "error" : "success"} sx={{ borderRadius: R.md }} onClose={() => setNumberMsg("")}>
              {numberMsg}
            </Alert>
          )}
        </Box>
      )}

      {failed > 0 && !loading && (
        <Alert severity="warning" sx={{ mb: 2.5, borderRadius: R.md }} action={<Button size="small" color="inherit" onClick={refresh} sx={{ fontWeight: 700 }}>Refresh</Button>}>
          Some data couldn't be loaded, so this report may be incomplete.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Skeleton variant="rounded" height={92} sx={{ borderRadius: R.lg }} />
          <Skeleton variant="rounded" height={110} sx={{ borderRadius: R.lg }} />
          <Skeleton variant="rounded" height={240} sx={{ borderRadius: R.lg }} />
        </Box>
      ) : !report ? (
        <Box sx={{ ...panelSx, py: 5, px: 3, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 700 }}>Choose a valid period</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The end date must be on or after the start date.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* ───── Document bar: what this is + export ───── */}
          <Box sx={{ ...panelSx, p: { xs: 2, sm: 2.25 } }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { md: "center" }, gap: 2, flexDirection: { xs: "column", md: "row" } }}>
              <Box sx={{ ...row, gap: 1.5, minWidth: 0 }}>
                <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
                  {(() => {
                    const Icon = (REPORTS.find((r) => r.id === tab) || REPORTS[0]).Icon;
                    return <Icon />;
                  })()}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.1rem", sm: "1.25rem" }, letterSpacing: "-0.01em", lineHeight: 1.25 }}>{report.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    {rangeLabel} · {propertyLabel} · Prepared by {ownerName}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", md: "auto auto auto" }, gap: 1, flexShrink: 0 }}>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleSavePdf}
                  disabled={savingPdf}
                  startIcon={savingPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfOutlinedIcon />}
                  sx={{ borderRadius: R.sm, fontWeight: 700, minHeight: 42, gridColumn: { xs: "1 / -1", md: "auto" } }}
                >
                  {savingPdf ? "Saving…" : "Save PDF"}
                </Button>
                <Button variant="outlined" color="inherit" onClick={handlePrint} startIcon={<PrintOutlinedIcon />} sx={{ borderRadius: R.sm, fontWeight: 700, minHeight: 42, borderColor: "divider", gridColumn: { xs: "span 1", md: "auto" } }}>
                  Print
                </Button>
                <Button variant="outlined" color="inherit" onClick={handleCsv} startIcon={<FileDownloadOutlinedIcon />} sx={{ borderRadius: R.sm, fontWeight: 700, minHeight: 42, borderColor: "divider", gridColumn: { xs: "span 2", md: "auto" } }}>
                  CSV
                </Button>
              </Box>
            </Box>

            {exportError && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: R.sm }} onClose={() => setExportError("")}>
                {exportError}
              </Alert>
            )}

            {multi && (
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 2, pt: 1.75, borderTop: "1px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mr: 0.5 }}>
                  Jump to
                </Typography>
                {report.parts
                  .filter((p) => p.id !== "summary")
                  .map((p, i) => (
                    <Box
                      key={p.id}
                      component="button"
                      type="button"
                      onClick={() => jumpTo(p.id)}
                      sx={{ ...row, gap: 0.75, height: 30, pl: 0.5, pr: 1.25, borderRadius: 99, font: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: "1px solid", borderColor: "divider", bgcolor: "background.default", color: "text.secondary", "&:hover": { color: "text.primary", borderColor: "text.secondary" } }}
                    >
                      <Box component="span" sx={{ width: 20, height: 20, borderRadius: 99, display: "grid", placeItems: "center", bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: "primary.main", fontSize: 11 }}>{i + 1}</Box>
                      {p.title}
                    </Box>
                  ))}
                {(() => {
                  const parts = report.parts.filter((p) => p.id !== "summary");
                  const allOpen = parts.every((p) => openParts[p.id]);
                  return (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => setAllParts(!allOpen)}
                      startIcon={allOpen ? <UnfoldLessRoundedIcon /> : <UnfoldMoreRoundedIcon />}
                      sx={{ ml: { sm: "auto" }, fontWeight: 700, color: "text.secondary" }}
                    >
                      {allOpen ? "Hide all" : "Show all"}
                    </Button>
                  );
                })()}
              </Box>
            )}
          </Box>

          {(() => {
            let n = 0;
            return report.parts.map((part) => {
              const number = part.id === "summary" ? 0 : (n += 1);
              return (
                <PartView key={part.id} part={part} number={number} showHeading={multi} onJump={jumpTo} open={Boolean(openParts[part.id])} onToggle={() => togglePart(part.id)} />
              );
            });
          })()}
        </Box>
      )}
    </Box>
  );
}
