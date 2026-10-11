import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CardActionArea,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { issueMissingReceipts } from "../../utils/receipt";
import { normalizePayment } from "../../utils/normalizePayment";
import { useAuth } from "../../context/AuthContext";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

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
const rentOf = (t) => Number(t.monthlyRent ?? t.rentAmount ?? t.roomMonthlyRate ?? t.monthlyRate ?? t.rent ?? 0) || 0;
const propOf = (x) => x.propertyId || x.assignedPropertyId || "";

const tenantState = (t) => {
  const s = String(t.status || "active").trim().toLowerCase();
  if (s.includes("pending")) return "pending";
  if (s === "inactive" || s === "archived") return "inactive";
  return "active";
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
  { id: "all", label: "All reports", Icon: AssessmentOutlinedIcon },
  { id: "payments", label: "Payments", Icon: PaymentsOutlinedIcon },
  { id: "journal", label: "Cash receipts", Icon: ReceiptLongOutlinedIcon },
  { id: "occupancy", label: "Occupancy", Icon: HomeWorkOutlinedIcon },
  { id: "maintenance", label: "Maintenance", Icon: BuildOutlinedIcon },
  { id: "curfew", label: "Curfew", Icon: NightsStayOutlinedIcon },
];

// ------------------------------------------------------------
// REPORT BUILDERS
// A report is { title, signoff, parts: [{ id, title, headline, tiles, sections }] }.
// Rows hold display text; an optional "<key>_raw" holds the plain value used for CSV.
// ------------------------------------------------------------

function buildPayments({ payments, range }) {
  const fromD = startOfDay(range.from);
  const toD = endOfDay(range.to);
  const rows = payments
    .map((p) => {
      const paidOn = toDate(p.paymentDate) || toDate(p.createdAt);
      // The month the rent is FOR decides which month it belongs to (an October rent paid on Sept 30 is October's)
      const eff = periodDate(p.periodMonth) || paidOn;
      return { ...p, paidOn, eff, status: String(p.status || "").toLowerCase() };
    })
    .filter((p) => p.eff && monthIdx(p.eff) >= monthIdx(fromD) && monthIdx(p.eff) <= monthIdx(toD));

  const sum = (list) => num(list.reduce((t, p) => t + (Number(p.amount) || 0), 0));
  const paid = rows.filter((p) => p.status === "paid");
  const pending = rows.filter((p) => p.status === "pending");
  const unsettled = rows.filter((p) => p.status === "partial" || p.status === "overdue");
  const rejected = rows.filter((p) => p.status === "rejected");

  const byMonth = new Map();
  rows.forEach((p) => {
    const key = monthIdx(p.eff);
    const cur = byMonth.get(key) || { label: fmtMonth(p.eff), count: 0, paid: 0, pending: 0 };
    cur.count += 1;
    if (p.status === "paid") cur.paid += Number(p.amount) || 0;
    if (p.status === "pending") cur.pending += Number(p.amount) || 0;
    byMonth.set(key, cur);
  });

  const group = (keyFn) => {
    const m = new Map();
    rows.forEach((p) => {
      const k = keyFn(p);
      const cur = m.get(k) || { name: k, count: 0, paid: 0, pending: 0, other: 0 };
      cur.count += 1;
      const amt = Number(p.amount) || 0;
      if (p.status === "paid") cur.paid += amt;
      else if (p.status === "pending") cur.pending += amt;
      else if (p.status === "partial" || p.status === "overdue") cur.other += amt;
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.paid - a.paid || a.name.localeCompare(b.name));
  };

  const moneyRows = (list) =>
    list.map((g) => ({ ...g, paid_raw: num(g.paid), pending_raw: num(g.pending), other_raw: num(g.other), paid: peso(g.paid), pending: peso(g.pending), other: peso(g.other) }));
  const sumOf = (list, k) => num(list.reduce((t, g) => t + g[k], 0));

  const monthList = [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m);
  const propList = group((p) => p.propertyName || "Unassigned");
  const methodList = group((p) => p.paymentMethod || "Not stated");

  const total = (list, keys) => {
    const t = { count: list.reduce((n, g) => n + g.count, 0) };
    keys.forEach((k) => {
      t[`${k}_raw`] = sumOf(list, k);
      t[k] = peso(sumOf(list, k));
    });
    return t;
  };

  return {
    id: "payments",
    title: "Payments",
    headline: { label: "Rent collected", tone: "success", value: peso(sum(paid)), raw: sum(paid), hint: plural(paid.length, "payment", "payments") },
    tiles: [
      { label: "Collected", value: peso(sum(paid)), raw: sum(paid), tone: paid.length ? "success" : undefined, hint: plural(paid.length, "payment", "payments") },
      { label: "Awaiting verification", value: peso(sum(pending)), raw: sum(pending), tone: pending.length ? "warning" : undefined, hint: plural(pending.length, "payment", "payments") },
      { label: "Partial / overdue", value: peso(sum(unsettled)), raw: sum(unsettled), tone: unsettled.length ? "error" : undefined, hint: plural(unsettled.length, "payment", "payments") },
      { label: "Records", value: String(rows.length), raw: rows.length, hint: rejected.length ? `${rejected.length} rejected` : undefined },
    ],
    sections: [
      {
        title: "By billing month",
        note: "Grouped by the month the rent is for, not the day it was paid.",
        columns: [
          { key: "label", label: "Billing month" },
          { key: "count", label: "Payments", align: "right" },
          { key: "paid", label: "Collected", align: "right" },
          { key: "pending", label: "Pending", align: "right" },
        ],
        rows: moneyRows(monthList),
        totals: { label: "Total", ...total(monthList, ["paid", "pending"]) },
        empty: "No payments in this period.",
      },
      {
        title: "By property",
        columns: [
          { key: "name", label: "Property" },
          { key: "count", label: "Payments", align: "right" },
          { key: "paid", label: "Collected", align: "right" },
          { key: "pending", label: "Pending", align: "right" },
          { key: "other", label: "Partial / overdue", align: "right" },
        ],
        rows: moneyRows(propList),
        totals: { name: "Total", ...total(propList, ["paid", "pending", "other"]) },
        empty: "No payments in this period.",
      },
      {
        title: "By payment method",
        note: "Collected = confirmed (Paid) payments only.",
        columns: [
          { key: "name", label: "Method" },
          { key: "count", label: "Payments", align: "right" },
          { key: "paid", label: "Collected", align: "right" },
        ],
        rows: moneyRows(methodList),
        totals: { name: "Total", ...total(methodList, ["paid"]) },
        empty: "No payments in this period.",
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
            status: cap(p.status),
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
    .filter((p) => p.status === "paid" && p.paidOn && p.paidOn >= fromD && p.paidOn <= toD)
    .sort((a, b) => (a.receiptSeq ?? Infinity) - (b.receiptSeq ?? Infinity) || a.paidOn - b.paidOn);

  const total = num(rows.reduce((t, p) => t + (Number(p.amount) || 0), 0));
  const numbered = rows.filter((p) => p.receiptNo);
  const missing = rows.length - numbered.length;

  return {
    id: "journal",
    title: "Cash receipts journal",
    headline: { label: "Gross receipts", value: peso(total), raw: total, hint: plural(rows.length, "receipt", "receipts") },
    tiles: [
      { label: "Gross receipts", value: peso(total), raw: total },
      { label: "Receipts", value: String(rows.length), raw: rows.length },
      { label: "Receipt numbers", value: numbered.length ? `${numbered[0].receiptNo} – ${numbered[numbered.length - 1].receiptNo}` : "—" },
      { label: "Without a number", value: String(missing), raw: missing, tone: missing ? "warning" : undefined, hint: missing ? "see the notice on the page" : undefined },
    ],
    sections: [
      {
        title: "Rent received",
        primary: "tenant",
        note: "Confirmed (Paid) payments only, listed by the date the money was received.",
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
          particulars: `Rent for ${p.periodMonth || "—"} · ${p.propertyName || "—"}, Room ${p.roomNumber || "N/A"}`,
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
  const perProperty = properties.map((p) => {
    const mine = tenants.filter((t) => propOf(t) === p.id);
    const active = mine.filter((t) => tenantState(t) === "active").length;
    const pending = mine.filter((t) => tenantState(t) === "pending").length;
    return {
      ...p,
      active,
      pending,
      vacant: Math.max(p.capacity - active, 0),
      rate: p.capacity > 0 ? Math.min(Math.round((active / p.capacity) * 100), 100) : 0,
    };
  });

  const beds = perProperty.reduce((t, p) => t + p.capacity, 0);
  const active = perProperty.reduce((t, p) => t + p.active, 0);
  const pending = perProperty.reduce((t, p) => t + p.pending, 0);
  const rate = beds > 0 ? Math.min(Math.round((active / beds) * 100), 100) : 0;
  const current = tenants.filter((t) => tenantState(t) !== "inactive");
  const expected = num(current.filter((t) => tenantState(t) === "active").reduce((t, x) => t + rentOf(x), 0));
  const nameOf = new Map(properties.map((p) => [p.id, p.name]));

  return {
    id: "occupancy",
    title: "Occupancy",
    headline: { label: "Occupancy rate", value: `${rate}%`, raw: rate, hint: `${active} of ${beds} beds` },
    tiles: [
      { label: "Total beds", value: String(beds), raw: beds },
      { label: "Occupied", value: String(active), raw: active, hint: pending ? `${pending} more awaiting move-in` : undefined },
      { label: "Vacant", value: String(Math.max(beds - active, 0)), raw: Math.max(beds - active, 0) },
      { label: "Occupancy rate", value: `${rate}%`, raw: rate },
      { label: "Monthly rent expected", value: peso(expected), raw: expected, hint: "from active tenants" },
    ],
    sections: [
      {
        title: "By property",
        note: "A snapshot as of today.",
        columns: [
          { key: "name", label: "Property" },
          { key: "capacity", label: "Beds", align: "right" },
          { key: "active", label: "Occupied", align: "right" },
          { key: "vacant", label: "Vacant", align: "right" },
          { key: "pending", label: "Pending", align: "right" },
          { key: "rate", label: "Rate", align: "right" },
        ],
        rows: perProperty.map((p) => ({ ...p, rate_raw: p.rate, rate: `${p.rate}%` })),
        totals: { name: "Total", capacity: beds, active, vacant: Math.max(beds - active, 0), pending, rate_raw: rate, rate: `${rate}%` },
        empty: "No properties yet.",
      },
      {
        title: "Current tenants",
        note: "Active tenants and those waiting to move in. Inactive and archived tenants are not listed.",
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
    .map((t) => ({ ...t, created: toDate(t.createdAt), resolved: toDate(t.resolvedAt), status: t.status || "Pending" }))
    .filter((t) => t.created && t.created >= fromD && t.created <= toD);

  const isOpen = (t) => t.status === "Pending" || t.status === "In Progress";
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
  const statusRows = ["Pending", "In Progress", "Resolved", "Cancelled"].map((s) => ({ status: s, count: rows.filter((t) => t.status === s).length }));

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
        columns: [
          { key: "title", label: "Request" },
          { key: "tenant", label: "Tenant" },
          { key: "where", label: "Property / room" },
          { key: "priority", label: "Priority", chip: true },
          { key: "status", label: "Status", chip: true },
          { key: "submitted", label: "Submitted" },
          { key: "resolved", label: "Resolved" },
          { key: "days", label: "Days", align: "right" },
        ],
        rows: [...rows]
          .sort((a, b) => b.created - a.created)
          .map((t) => {
            const d = days(t);
            const done = t.status === "Resolved";
            return {
              title: t.title || "Untitled request",
              tenant: t.tenantName || "—",
              where: `${t.propertyName || "—"}, Room ${t.roomNumber || "N/A"}`,
              priority: t.priority?.tier || "—",
              status: t.status,
              submitted_raw: ymd(t.created),
              submitted: fmtDate(t.created),
              resolved_raw: done && t.resolved ? ymd(t.resolved) : "",
              resolved: done ? fmtDate(t.resolved) : "—",
              days_raw: done && d !== null ? Number(d.toFixed(1)) : "",
              days: done && d !== null ? d.toFixed(1) : "—",
            };
          }),
        empty: "No requests in this period.",
      },
    ],
  };
}

function buildCurfew({ logs, range }) {
  const nights = logs
    .map((l) => ({ ...l, night: String(l.date || String(l.id || "").slice(-10)).slice(0, 10) }))
    .filter((l) => !/^\d{4}-\d{2}-\d{2}$/.test(l.night) || (l.night >= range.from && l.night <= range.to));

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
            date: toDate(f.night) ? fmtDate(toDate(f.night)) : f.night,
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
  const parts = [
    buildPayments(args),
    buildJournal(args),
    buildOccupancy(args),
    buildMaintenance(args),
    buildCurfew(args),
  ];
  return {
    title: "Full report",
    signoff: true,
    parts: [
      {
        id: "summary",
        title: "Summary",
        tiles: parts.map((p) => ({ ...p.headline, partId: p.id })),
        sections: [],
      },
      ...parts,
    ],
  };
}

const wrapSingle = (part, title, signoff = false) => ({ title, signoff, parts: [part] });

// ------------------------------------------------------------
// EXPORT — print / save as PDF, and CSV. Both come from the same report object as the screen,
// so the page, the PDF and the spreadsheet always agree.
// ------------------------------------------------------------

const buildPrintHtml = (report, meta) => {
  const multi = report.parts.length > 1;
  const wide = report.parts.some((p) => p.sections.some((s) => s.columns.length >= 7));
  const cls = (c) => (c.align === "right" ? "r" : "");

  const tilesHtml = (tiles) =>
    tiles.length
      ? `<div class="tiles">${tiles
          .map((t) => `<div class="tile"><div class="tl">${escapeHtml(t.label)}</div><div class="tv">${escapeHtml(t.value)}</div>${t.hint ? `<div class="th">${escapeHtml(t.hint)}</div>` : ""}</div>`)
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
    const w = s.columns.length <= 3 ? 50 : s.columns.length === 4 ? 65 : s.columns.length === 5 ? 80 : 100;
    return `<section><h3>${escapeHtml(s.title)}</h3>${s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : ""}<table class="data" style="width:${w}%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></section>`;
  };

  const partsHtml = report.parts
    .map((p, i) => {
      const heading = multi ? `<h2 class="ph">${escapeHtml(p.title)}</h2>` : "";
      // In the full report the summary shares page 1 with the first report; every report after that starts on a new page
      return `<div class="part${multi && i > 1 ? " newpage" : ""}">${heading}${tilesHtml(p.tiles)}${p.sections.map(sectionHtml).join("")}</div>`;
    })
    .join("");

  const signoff = report.signoff
    ? `<div class="sign"><div><div class="line"></div>Prepared by<br><strong>${escapeHtml(meta.owner)}</strong></div><div><div class="line"></div>Checked / approved by</div><div><div class="line"></div>Date</div></div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>
    /* Page margins are built into the layout (spacer rows + side padding) instead of relying on @page margins,
       which some print dialogs ignore or reset to "None". */
    @page{size:A4 ${wide ? "landscape" : "portrait"};margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    .frame{width:100%;border-collapse:collapse}
    .frame>thead{display:table-header-group}.frame>tfoot{display:table-footer-group}
    .frame>thead>tr>td,.frame>tfoot>tr>td,.frame>tbody>tr>td{padding:0;border:0;background:none}
    .sp-top{height:14mm}.sp-bot{height:16mm}
    .page{padding:0 13mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#222;font-size:12px;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #222;padding-bottom:6px}
    .brand{font-size:12px;letter-spacing:.1em;color:#ff4500;font-weight:700;text-transform:uppercase}
    .gen{color:#777;font-size:11px}
    h1{font-size:25px;margin:14px 0 10px}
    .meta{display:flex;flex-wrap:wrap;gap:6px 28px;margin:0 0 14px}
    .meta div{min-width:90px}.meta dt{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888}.meta dd{margin:1px 0 0;font-weight:600}
    .ph{font-size:19px;margin:18px 0 12px;padding-bottom:4px;border-bottom:1px solid #bbb}
    .newpage{break-before:page;page-break-before:always}
    .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:4px}
    .tile{border:1px solid #d6d6d6;border-radius:6px;padding:8px 10px;break-inside:avoid}
    .tl{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.05em}
    .tv{font-size:19px;font-weight:700;margin-top:4px}.th{font-size:10px;color:#888;margin-top:2px}
    section{margin-top:16px}
    h3{font-size:14px;margin:0 0 3px;break-after:avoid;page-break-after:avoid}
    .note{color:#777;font-size:11px;margin:0 0 6px}
    table.data{width:100%;border-collapse:collapse}
    table.data thead{display:table-header-group}
    table.data tfoot{display:table-row-group}
    table.data th{background:#eceff1;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #999;border-bottom:1px solid #999}
    table.data th,table.data td{padding:6px 8px;vertical-align:top}
    table.data td{border-bottom:1px solid #e6e6e6}
    table.data tbody tr:nth-child(even) td{background:#fafafa}
    table.data tr{break-inside:avoid;page-break-inside:avoid}
    table.data tfoot td{border-top:2px solid #222;border-bottom:0;font-weight:700;background:#f2f2f2}
    .r{text-align:right;white-space:nowrap}.empty{color:#888;text-align:center;padding:14px}
    .sign{display:flex;gap:28px;margin-top:44px;break-inside:avoid;page-break-inside:avoid}
    .sign>div{flex:1;font-size:11px;color:#555}.line{border-bottom:1px solid #222;height:28px;margin-bottom:4px}
    .foot{margin-top:22px;color:#999;font-size:10px;border-top:1px solid #e0e0e0;padding-top:6px}
  </style></head><body>
  <table class="frame"><thead><tr><td><div class="sp-top"></div></td></tr></thead><tbody><tr><td><div class="page">
    <div class="top"><span class="brand">KwartoKeeper</span><span class="gen">Generated ${escapeHtml(meta.generated)}</span></div>
    <h1>${escapeHtml(report.title)}</h1>
    <dl class="meta">
      <div><dt>Period</dt><dd>${escapeHtml(meta.range)}</dd></div>
      <div><dt>Property</dt><dd>${escapeHtml(meta.property)}</dd></div>
      <div><dt>Prepared by</dt><dd>${escapeHtml(meta.owner)}</dd></div>
    </dl>
    ${partsHtml}${signoff}
    <div class="foot">Figures are taken from the records in KwartoKeeper at the time of printing.</div>
  </div></td></tr></tbody><tfoot><tr><td><div class="sp-bot"></div></td></tr></tfoot></table>
  </body></html>`;
};

const printReport = (report, meta) => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  win.document.open();
  win.document.write(buildPrintHtml(report, meta));
  win.document.close();
  win.onafterprint = () => setTimeout(() => iframe.remove(), 500);
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 60000); // in case afterprint never fires
  }, 250);
};

// Save a real PDF file (no print dialog). Needs: npm install jspdf jspdf-autotable
const savePdf = async (report, meta, filename) => {
  const [{ jsPDF }, tableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = tableModule.default || tableModule.autoTable;

  const multi = report.parts.length > 1;
  const wide = report.parts.some((p) => p.sections.some((s) => s.columns.length >= 7));
  const doc = new jsPDF({ orientation: wide ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = { left: 40, right: 40, top: 48, bottom: 54 };
  const contentW = W - M.left - M.right;
  // The built-in PDF fonts have no peso sign, so it is written as "PHP"
  const t = (v) => String(v ?? "").replace(/₱/g, "PHP ").replace(/\s+/g, " ").trim();
  const DARK = [34, 34, 34];
  const GRAY = [120, 120, 120];
  let y = M.top;

  const ensure = (need) => {
    if (y + need > H - M.bottom) {
      doc.addPage();
      y = M.top;
    }
  };

  // Header
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 69, 0);
  doc.text("KWARTOKEEPER", M.left, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY);
  doc.text(`Generated ${t(meta.generated)}`, W - M.right, y, { align: "right" });
  doc.setDrawColor(...DARK).setLineWidth(1.2).line(M.left, y + 6, W - M.right, y + 6);
  y += 30;
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...DARK);
  doc.text(t(report.title), M.left, y);
  y += 20;
  [["Period", meta.range], ["Property", meta.property], ["Prepared by", meta.owner]].forEach(([label, value], i) => {
    const x = M.left + i * Math.min(contentW / 3, 230);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...GRAY).text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...DARK).text(t(value), x, y + 12, { maxWidth: Math.min(contentW / 3, 230) - 10 });
  });
  y += 34;

  const drawTiles = (tiles) => {
    if (!tiles.length) return;
    const gap = 8;
    const cols = Math.min(tiles.length, wide ? 5 : 4);
    const boxW = (contentW - gap * (cols - 1)) / cols;
    const boxH = 50;
    tiles.forEach((tile, i) => {
      const col = i % cols;
      if (col === 0) ensure(boxH + gap);
      const x = M.left + col * (boxW + gap);
      doc.setDrawColor(210, 210, 210).setLineWidth(0.7).roundedRect(x, y, boxW, boxH, 4, 4);
      doc.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...GRAY).text(t(tile.label).toUpperCase(), x + 8, y + 14, { maxWidth: boxW - 16 });
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...DARK).text(t(tile.value), x + 8, y + 31, { maxWidth: boxW - 16 });
      if (tile.hint) doc.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...GRAY).text(t(tile.hint), x + 8, y + 43, { maxWidth: boxW - 16 });
      if (col === cols - 1 || i === tiles.length - 1) y += boxH + gap;
    });
  };

  report.parts.forEach((part, i) => {
    if (multi && i > 1) {
      doc.addPage();
      y = M.top;
    }
    if (multi) {
      ensure(40);
      doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...DARK).text(t(part.title), M.left, y + 4);
      doc.setDrawColor(190, 190, 190).setLineWidth(0.7).line(M.left, y + 10, W - M.right, y + 10);
      y += 26;
    }
    drawTiles(part.tiles);

    part.sections.forEach((s) => {
      ensure(70);
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...DARK).text(t(s.title), M.left, y + 4);
      y += 14;
      if (s.note) {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY).text(t(s.note), M.left, y + 2, { maxWidth: contentW });
        y += 12;
      }
      const w = s.columns.length <= 3 ? 0.5 : s.columns.length === 4 ? 0.65 : s.columns.length === 5 ? 0.8 : 1;
      const columnStyles = {};
      s.columns.forEach((c, ci) => {
        if (c.align === "right") columnStyles[ci] = { halign: "right", cellWidth: "wrap" };
      });
      autoTable(doc, {
        startY: y + 2,
        margin: { top: M.top, left: M.left, right: M.right, bottom: M.bottom },
        tableWidth: contentW * w,
        head: [s.columns.map((c) => ({ content: t(c.label), styles: { halign: c.align === "right" ? "right" : "left" } }))],
        body: s.rows.length
          ? s.rows.map((r) => s.columns.map((c) => t(r[c.key])))
          : [[{ content: t(s.empty || "Nothing to show."), colSpan: s.columns.length, styles: { halign: "center", textColor: GRAY } }]],
        foot: s.totals && s.rows.length ? [s.columns.map((c) => t(s.totals[c.key] ?? ""))] : undefined,
        showFoot: "lastPage",
        theme: "plain",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: DARK, overflow: "linebreak", lineColor: [230, 230, 230], lineWidth: { bottom: 0.5 } },
        headStyles: { fillColor: [236, 239, 241], fontStyle: "bold", fontSize: 7.5, textColor: [70, 70, 70], lineWidth: 0 },
        footStyles: { fillColor: [242, 242, 242], fontStyle: "bold", textColor: DARK },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles,
      });
      y = doc.lastAutoTable.finalY + 20;
    });
  });

  if (report.signoff) {
    ensure(90);
    y += 24;
    const colW = (contentW - 40) / 3;
    ["Prepared by", "Checked / approved by", "Date"].forEach((label, i) => {
      const x = M.left + i * (colW + 20);
      doc.setDrawColor(...DARK).setLineWidth(0.8).line(x, y + 24, x + colW, y + 24);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY).text(label, x, y + 36);
      if (i === 0) doc.setFont("helvetica", "bold").setTextColor(...DARK).text(t(meta.owner), x, y + 48);
    });
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150, 150, 150);
    doc.text("KwartoKeeper", M.left, H - 26);
    doc.text(`Page ${p} of ${pages}`, W - M.right, H - 26, { align: "right" });
  }

  doc.save(filename);
};

// CSV cells: numbers stay numbers (so Excel can sum them); text that could be read as a formula is defused
const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let t = String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
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
      part.tiles.forEach((t) => lines.push(csvLine([t.label, t.raw !== undefined ? t.raw : t.value, t.hint || ""])));
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
  return `﻿${lines.join("\r\n")}\r\n`; // BOM so Excel reads ₱ and accents correctly
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

const TILE_GRID = { display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" };

const STATUS_TONES = {
  paid: "success", active: "success", resolved: "success", approved: "success",
  pending: "warning", partial: "warning", late: "warning", medium: "warning",
  "in progress": "info",
  overdue: "error", rejected: "error", out: "error", high: "error",
};
const statusTone = (text) => STATUS_TONES[String(text || "").trim().toLowerCase()] || "default";

function StatusChip({ text }) {
  if (!text || text === "—") return <>{text || "—"}</>;
  const tone = statusTone(text);
  return <Chip size="small" label={text} color={tone} variant={tone === "default" ? "outlined" : "filled"} sx={{ fontWeight: 700, height: 22 }} />;
}

function Tile({ label, value, hint, tone, onClick }) {
  const body = (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.15rem", sm: "1.35rem" }, lineHeight: 1.25, mt: 0.25, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderLeft: tone ? "4px solid" : undefined,
        borderLeftColor: tone ? `${tone}.main` : undefined,
        borderRadius: 3,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {onClick ? <CardActionArea onClick={onClick}>{body}</CardActionArea> : body}
    </Paper>
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
  const cell = (r, c) => (c.chip ? <StatusChip text={r[c.key]} /> : r[c.key]);

  // Phones: wide tables read badly, so each row becomes a small card
  const asCards = isPhone && section.columns.length >= 4;
  const primary = section.columns.find((c) => c.key === section.primary) || section.columns[0];
  const amount = section.columns.length > 2 && section.columns[section.columns.length - 1].align === "right" ? section.columns[section.columns.length - 1] : null;
  const details = section.columns.filter((c) => c !== primary && c !== amount);

  return (
    <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", minWidth: 0 }}>
      <Box sx={{ px: 2, pt: 1.5, pb: section.note || searchable ? 1 : 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {section.title}
          </Typography>
          {section.rows.length > 0 && <Chip size="small" variant="outlined" label={section.rows.length} sx={{ height: 20, fontWeight: 700 }} />}
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
              sx={{ ml: { sm: "auto" }, width: { xs: 1, sm: 240 } }}
            />
          )}
        </Box>
        {section.note && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            {section.note}
          </Typography>
        )}
      </Box>

      {section.rows.length === 0 || filtered.length === 0 ? (
        <Box sx={{ py: 4, px: 2, textAlign: "center", color: "text.secondary", borderTop: "1px solid", borderColor: "divider" }}>
          <InboxOutlinedIcon sx={{ fontSize: 30, opacity: 0.5 }} />
          <Typography variant="body2">{section.rows.length === 0 ? section.empty || "Nothing to show." : "No matches."}</Typography>
        </Box>
      ) : asCards ? (
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
          {visible.map((r, i) => (
            <Box key={i} sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, alignItems: "baseline" }}>
                <Typography fontWeight={700} sx={{ minWidth: 0, overflowWrap: "anywhere" }} component="div">
                  {cell(r, primary)}
                </Typography>
                {amount && (
                  <Typography fontWeight={800} sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }} component="div">
                    {cell(r, amount)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ mt: 0.75, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1.5, rowGap: 0.4, alignItems: "center" }}>
                {details
                  .filter((c) => r[c.key] !== undefined && r[c.key] !== "" && r[c.key] !== "—")
                  .map((c) => (
                    <React.Fragment key={c.key}>
                      <Typography variant="caption" color="text.secondary">
                        {c.label}
                      </Typography>
                      <Typography variant="body2" component="div" sx={{ overflowWrap: "anywhere" }}>
                        {cell(r, c)}
                      </Typography>
                    </React.Fragment>
                  ))}
              </Box>
            </Box>
          ))}
          {section.totals && !q && (
            <Box sx={{ px: 2, py: 1.5, bgcolor: "action.hover", display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1.5, rowGap: 0.25 }}>
              {section.columns
                .filter((c) => section.totals[c.key] !== undefined && section.totals[c.key] !== "")
                .map((c, i) => (
                  <React.Fragment key={c.key}>
                    {i > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {c.label}
                      </Typography>
                    )}
                    <Typography variant="body2" fontWeight={800} sx={i === 0 ? { gridColumn: "1 / -1" } : { textAlign: "right" }}>
                      {section.totals[c.key]}
                    </Typography>
                  </React.Fragment>
                ))}
            </Box>
          )}
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 440, borderTop: "1px solid", borderColor: "divider" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {section.columns.map((c) => (
                  <TableCell key={c.key} align={c.align || "left"} sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}>
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
                    <TableCell key={c.key} align={c.align || "left"} sx={{ fontWeight: 800, whiteSpace: "nowrap", borderTop: "2px solid", borderColor: "divider", bgcolor: "action.hover", fontVariantNumeric: "tabular-nums" }}>
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
            <Button size="small" onClick={() => setShowAll(true)}>
              Show all
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}

function PartView({ part, showHeading, onJump }) {
  const [open, setOpen] = useState(true);
  return (
    <Box id={`part-${part.id}`} sx={{ scrollMarginTop: { xs: 72, md: 96 } }}>
      {showHeading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, pb: 0.75, mb: 2, borderBottom: "2px solid", borderColor: "divider" }}>
          <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
            {part.title}
          </Typography>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label={open ? `Collapse ${part.title}` : `Expand ${part.title}`} aria-expanded={open}>
            <ExpandMoreIcon sx={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .2s" }} />
          </IconButton>
        </Box>
      )}
      <Collapse in={open} unmountOnExit={false}>
        <Stack spacing={2}>
          {part.tiles.length > 0 && (
            <Box sx={TILE_GRID}>
              {part.tiles.map((t) => (
                <Tile key={t.label} {...t} onClick={t.partId && onJump ? () => onJump(t.partId) : undefined} />
              ))}
            </Box>
          )}
          {part.sections.map((s) => (
            <ReportTable key={s.title} section={s} />
          ))}
        </Stack>
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

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(0);
  const [data, setData] = useState({ owner: {}, properties: [], tenants: [], payments: [], tickets: [], logs: [] });
  const [numbering, setNumbering] = useState(false);
  const [numberMsg, setNumberMsg] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [exportError, setExportError] = useState("");

  const [tab, setTab] = useState("all");
  const [propertyId, setPropertyId] = useState("all");
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(presetRange("month"));

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
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
      .map((p) => ({ id: p.id, name: p.propertyName || "Unnamed property", capacity: propertyCapacity(p) }))
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
    const tenants = [...byId.values()].filter((t) => t.ownerUid === uid || ownedIds.has(propOf(t)));

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

    setData({ owner, properties, tenants, payments, tickets, logs: [...logMap.values()] });
    setFailed(bad);
    setLoadedAt(new Date());
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const pickPreset = (id) => {
    setPreset(id);
    setRange(presetRange(id));
  };

  const setDate = (key) => (e) => {
    setPreset("");
    setRange((r) => ({ ...r, [key]: e.target.value }));
  };

  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);
  const selectedProperty = data.properties.find((p) => p.id === propertyId);

  const report = useMemo(() => {
    if (loading) return null;
    // Anything that belongs to the chosen property (older records may only carry the property name)
    const inProperty = (x) =>
      propertyId === "all" || propOf(x) === propertyId || (!propOf(x) && Boolean(selectedProperty) && x.propertyName === selectedProperty.name);
    const args = {
      range,
      payments: data.payments.filter(inProperty),
      tickets: data.tickets.filter(inProperty),
      logs: data.logs.filter(inProperty),
      tenants: data.tenants.filter(inProperty),
      properties: propertyId === "all" ? data.properties : data.properties.filter((p) => p.id === propertyId),
    };

    if (tab === "occupancy") return wrapSingle(buildOccupancy(args), "Occupancy report");
    if (!rangeValid) return null;
    if (tab === "all") return buildAll(args);
    if (tab === "journal") return wrapSingle(buildJournal(args), "Cash receipts journal", true);
    if (tab === "maintenance") return wrapSingle(buildMaintenance(args), "Maintenance report");
    if (tab === "curfew") return wrapSingle(buildCurfew(args), "Curfew report");
    return wrapSingle(buildPayments(args), "Payments report", true);
  }, [loading, data, tab, propertyId, range, rangeValid, selectedProperty]);

  const needsDates = tab !== "occupancy";
  const rangeLabel = needsDates ? `${fmtDate(toDate(range.from))} to ${fmtDate(toDate(range.to))}` : "As of today";

  const owner = data.owner || {};
  const ownerName = owner.fullName || owner.name || currentUser?.displayName || currentUser?.email || "Owner";

  const unnumbered = useMemo(
    () => data.payments.filter((p) => String(p.status || "").toLowerCase() === "paid" && !p.receiptNo),
    [data.payments]
  );

  const assignNumbers = async () => {
    setNumbering(true);
    setNumberMsg("");
    try {
      const when = (p) => (toDate(p.paymentDate) || toDate(p.createdAt) || new Date(0)).getTime();
      const n = await issueMissingReceipts(db, uid, [...unnumbered].sort((a, b) => when(a) - when(b)));
      setNumberMsg(`Numbered ${plural(n, "payment", "payments")}.`);
      await load();
    } catch (err) {
      console.error("Could not assign receipt numbers:", err);
      setNumberMsg("Couldn't assign every number. Refresh and try again.");
    } finally {
      setNumbering(false);
    }
  };

  const exportMeta = () => ({
    owner: ownerName,
    property: selectedProperty ? selectedProperty.name : "All properties",
    range: rangeLabel,
    generated: new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }),
  });

  const handlePrint = () => {
    if (report) printReport(report, exportMeta());
  };

  const fileStamp = () => (needsDates ? `${range.from}_to_${range.to}` : ymd(new Date()));

  const handleCsv = () => {
    if (report) downloadCsv(buildCsv(report, exportMeta()), `kwartokeeper_${tab}_${fileStamp()}.csv`);
  };

  const handleSavePdf = async () => {
    if (!report || savingPdf) return;
    setSavingPdf(true);
    setExportError("");
    try {
      await savePdf(report, exportMeta(), `kwartokeeper_${tab}_${fileStamp()}.pdf`);
    } catch (err) {
      console.error("Could not save the PDF:", err);
      setExportError("Couldn't save the PDF. If this keeps happening, use Print and choose \"Save as PDF\".");
    } finally {
      setSavingPdf(false);
    }
  };

  const jumpTo = (id) => document.getElementById(`part-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const showNumberNotice = !loading && (tab === "journal" || tab === "all");

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 2.5, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pick a report and a date range, then save it as a PDF, print it, or download it as a CSV.
          </Typography>
          {loadedAt && (
            <Typography variant="caption" color="text.secondary">
              Data as of {loadedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
            </Typography>
          )}
        </Box>
        <Button onClick={load} disabled={loading} startIcon={<RefreshIcon />} sx={{ borderRadius: 2 }}>
          Refresh
        </Button>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2.5 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
          {REPORTS.map(({ id, label, Icon }) => (
            <Tab key={id} value={id} label={label} icon={<Icon fontSize="small" />} iconPosition="start" sx={{ minHeight: 56, fontWeight: 700 }} />
          ))}
        </Tabs>

        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: needsDates ? "minmax(0, 2fr) repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" },
            }}
          >
            <FormControl size="small" fullWidth>
              <InputLabel>Property</InputLabel>
              <Select value={propertyId} label="Property" onChange={(e) => setPropertyId(e.target.value)}>
                <MenuItem value="all">All properties</MenuItem>
                {data.properties.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {needsDates && (
              <>
                <TextField label="From" type="date" size="small" value={range.from} onChange={setDate("from")} slotProps={{ inputLabel: { shrink: true } }} error={!rangeValid} fullWidth />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  value={range.to}
                  onChange={setDate("to")}
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!rangeValid}
                  helperText={!rangeValid ? "Must be on or after the start date." : undefined}
                  fullWidth
                />
              </>
            )}
          </Box>

          {needsDates ? (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 2 }}>
              {PRESETS.map((p) => (
                <Chip key={p.id} label={p.label} onClick={() => pickPreset(p.id)} color={preset === p.id ? "primary" : "default"} variant={preset === p.id ? "filled" : "outlined"} />
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              Occupancy is a snapshot of today, so it doesn't use dates.
            </Typography>
          )}
          {tab === "all" && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              The full report puts every report below in one document. Occupancy always shows today.
            </Typography>
          )}
        </Box>
      </Paper>

      {showNumberNotice && (unnumbered.length > 0 || numberMsg) && (
        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
          {unnumbered.length > 0 && (
            <Alert
              severity="warning"
              sx={{ borderRadius: 2 }}
              action={
                <Button size="small" onClick={assignNumbers} disabled={numbering}>
                  {numbering ? "Numbering…" : "Assign numbers"}
                </Button>
              }
            >
              {plural(unnumbered.length, "paid payment has", "paid payments have")} no receipt number yet. Assigning numbers them oldest first,
              continuing from your next receipt number.
            </Alert>
          )}
          {numberMsg && <Alert severity="success" sx={{ borderRadius: 2 }}>{numberMsg}</Alert>}
        </Stack>
      )}

      {failed > 0 && (
        <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2 }}>
          Some data couldn't be loaded, so this report may be incomplete. Try Refresh.
        </Alert>
      )}

      {loading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={84} />
          <Box sx={TILE_GRID}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={84} />
            ))}
          </Box>
          <Skeleton variant="rounded" height={220} />
        </Stack>
      ) : !report ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Choose a valid date range to see this report.
        </Alert>
      ) : (
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { sm: "center" }, gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={800}>
                  {report.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {rangeLabel} · {selectedProperty ? selectedProperty.name : "All properties"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Prepared by {ownerName}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap sx={{ width: { xs: 1, sm: "auto" }, flexShrink: 0, flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  onClick={handleSavePdf}
                  disabled={savingPdf}
                  startIcon={savingPdf ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfOutlinedIcon />}
                  sx={{ borderRadius: 2, flex: { xs: "1 1 100%", sm: "none" }, minHeight: 42 }}
                >
                  {savingPdf ? "Saving…" : "Save PDF"}
                </Button>
                <Button variant="outlined" onClick={handleCsv} startIcon={<FileDownloadOutlinedIcon />} sx={{ borderRadius: 2, flex: { xs: 1, sm: "none" }, minHeight: 42 }}>
                  CSV
                </Button>
                <Button variant="outlined" onClick={handlePrint} startIcon={<PrintOutlinedIcon />} sx={{ borderRadius: 2, flex: { xs: 1, sm: "none" }, minHeight: 42 }}>
                  Print
                </Button>
              </Stack>
            </Box>

            {exportError && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setExportError("")}>
                {exportError}
              </Alert>
            )}

            {report.parts.length > 1 && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider", alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Jump to
                </Typography>
                {report.parts.map((p) => (
                  <Chip key={p.id} label={p.title} size="small" variant="outlined" onClick={() => jumpTo(p.id)} />
                ))}
              </Stack>
            )}
          </Paper>

          {report.parts.map((part) => (
            <PartView key={part.id} part={part} showHeading={report.parts.length > 1} onJump={jumpTo} />
          ))}
        </Stack>
      )}
    </Box>
  );
}