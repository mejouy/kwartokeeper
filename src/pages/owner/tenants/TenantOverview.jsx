// src/pages/tenant/TenantOverview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography, Chip, Button, Avatar, Skeleton } from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PaymentsIcon from "@mui/icons-material/Payments";
import BuildIcon from "@mui/icons-material/Build";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PhoneIcon from "@mui/icons-material/Phone";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../config/firebase";

const ORANGE = "#FF6B35";
const CREAM = "#F5EFE6";
const BORDER = "#E5DFD5";
const INK = "#2D2D2D";

// ---------------------------------------------------------------- helpers
const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (value) => {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
};

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / 86400000);

// Same-month check used for "have they paid this month?"
const sameMonth = (a, b) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

// Rent is due on the day of the month the lease started. Returns the next such
// date (or null when there is no lease start on record).
const getNextDueDate = (leaseStart, paidThisMonth) => {
  const start = toDate(leaseStart);
  if (!start) return null;
  const today = startOfDay(new Date());
  const dayOf = (year, month) => new Date(year, month, Math.min(start.getDate(), new Date(year, month + 1, 0).getDate()));
  let due = dayOf(today.getFullYear(), today.getMonth());
  if (due < today || paidThisMonth) due = dayOf(today.getFullYear(), today.getMonth() + 1);
  return due;
};

const ticketTone = (status) => {
  const s = String(status || "Pending").toLowerCase();
  if (s === "resolved" || s === "completed") return "success";
  if (s.includes("progress")) return "info";
  return "warning";
};

// ------------------------------------------------------------------- page
export default function TenantOverview() {
  const navigate = useNavigate();

  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [payments, setPayments] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [caretaker, setCaretaker] = useState(null);

  // Who is signed in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // The tenant's own record (new "tenants" doc, falling back to the "users" doc)
  useEffect(() => {
    if (!authReady) return undefined;
    if (!uid) {
      setTenantLoading(false);
      return undefined;
    }
    let usersData = null;
    let tenantsData = null;
    const publish = () => {
      if (usersData || tenantsData) setTenant({ ...(usersData || {}), ...(tenantsData || {}) });
      setTenantLoading(false);
    };
    const onErr = (e) => {
      console.error("Error loading tenant record:", e);
      setTenantLoading(false);
    };
    const u1 = onSnapshot(doc(db, "tenants", uid), (s) => { tenantsData = s.exists() ? s.data() : null; publish(); }, onErr);
    const u2 = onSnapshot(doc(db, "users", uid), (s) => { usersData = s.exists() ? s.data() : null; publish(); }, onErr);
    return () => { u1(); u2(); };
  }, [authReady, uid]);

  // The property they live in
  useEffect(() => {
    if (!tenant?.propertyId) return;
    let cancelled = false;
    getDoc(doc(db, "properties", tenant.propertyId))
      .then((snap) => { if (!cancelled && snap.exists()) setProperty({ id: snap.id, ...snap.data() }); })
      .catch((e) => console.error("Error loading property:", e));
    return () => { cancelled = true; };
  }, [tenant?.propertyId]);

  // Their payments and maintenance tickets (live)
  useEffect(() => {
    if (!uid) return undefined;
    const unsubs = [];
    const watch = (q, setter, label, merge) =>
      unsubs.push(
        onSnapshot(
          q,
          (snap) => setter((prev) => merge(prev, snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
          (e) => console.error(`Error loading ${label}:`, e)
        )
      );

    watch(query(collection(db, "payments"), where("tenantId", "==", uid)), setPayments, "payments", (_, next) => next);

    // Tickets might be keyed by tenantId or tenantUid depending on how they were created
    const bySource = {};
    const mergeTickets = (key) => (_, next) => {
      bySource[key] = next;
      const all = new Map();
      Object.values(bySource).flat().forEach((t) => all.set(t.id, t));
      return [...all.values()];
    };
    watch(query(collection(db, "maintenance_tickets"), where("tenantId", "==", uid)), setTickets, "tickets", mergeTickets("tenantId"));
    watch(query(collection(db, "maintenance_tickets"), where("tenantUid", "==", uid)), setTickets, "tickets", mergeTickets("tenantUid"));

    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // The caretaker for their property (may be hidden by security rules; that's fine)
  useEffect(() => {
    if (!tenant?.ownerUid) return;
    let cancelled = false;
    getDoc(doc(db, "users", tenant.ownerUid)) // touch nothing sensitive; just warms the permission path
      .catch(() => {});
    const unsub = onSnapshot(
      query(collection(db, "users"), where("ownerUid", "==", tenant.ownerUid), where("role", "==", "caretaker")),
      (snap) => {
        if (cancelled) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const forThisProperty = list.find((c) => c.propertyId === tenant.propertyId);
        setCaretaker(forThisProperty || list[0] || null);
      },
      () => {}
    );
    return () => { cancelled = true; unsub(); };
  }, [tenant?.ownerUid, tenant?.propertyId]);

  // ---------------------------------------------------------- derived data
  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => (toDate(b.paymentDate || b.createdAt)?.getTime() || 0) - (toDate(a.paymentDate || a.createdAt)?.getTime() || 0)),
    [payments]
  );
  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)),
    [tickets]
  );
  const activeTickets = sortedTickets.filter((t) => !["resolved", "completed"].includes(String(t.status || "").toLowerCase()));

  const today = new Date();
  const paidThisMonth = payments.some((p) => {
    const d = toDate(p.paymentDate || p.createdAt);
    return d && sameMonth(d, today) && String(p.status || "Paid").toLowerCase() === "paid";
  });
  const nextDue = getNextDueDate(tenant?.leaseStartDate, paidThisMonth);
  const daysToDue = nextDue ? daysBetween(today, nextDue) : null;

  const monthlyRent = Number(tenant?.monthlyRent || tenant?.rentAmount || tenant?.roomMonthlyRate || 0);
  const leaseEnd = toDate(tenant?.leaseEndDate || tenant?.leaseEnd);
  const leaseStart = toDate(tenant?.leaseStartDate);
  const leaseDaysLeft = leaseEnd ? daysBetween(today, leaseEnd) : null;
  const leaseProgress =
    leaseStart && leaseEnd && leaseEnd > leaseStart
      ? Math.min(100, Math.max(0, Math.round(((today - leaseStart) / (leaseEnd - leaseStart)) * 100)))
      : null;

  const displayName = tenant?.fullName || tenant?.name || auth.currentUser?.displayName || "";
  const firstName = displayName.trim().split(" ")[0];
  const propertyName = property?.propertyName || property?.name || "Your residence";
  const status = tenant?.status || "Active";
  const statusTone = status === "Active" ? "success" : status === "Pending Onboarding" ? "warning" : "default";

  const rentSub = paidThisMonth
    ? "Paid for this month"
    : nextDue
      ? daysToDue === 0
        ? "Due today"
        : `Due ${fmtDate(nextDue)} · ${daysToDue} ${daysToDue === 1 ? "day" : "days"}`
      : "No due date set";
  const rentSubColor = paidThisMonth ? "success.main" : daysToDue !== null && daysToDue <= 3 ? "warning.main" : undefined;

  const loading = tenantLoading;
  const noRecord = !tenantLoading && !tenant;

  const callHref = (phone) => `tel:${String(phone || "").replace(/[^0-9+]/g, "")}`;
  const emergencyPhone = property?.emergencyPhone;

  // ------------------------------------------------------------------ UI
  const recentReport = sortedTickets[0];
  const reportTitle = recentReport && (recentReport.title || recentReport.issue || recentReport.category || "Maintenance request");
  const reportMeta = recentReport && [
    recentReport.room || recentReport.roomId || (tenant?.roomId ? `Room ${tenant.roomId}` : ""),
    fmtDate(recentReport.createdAt) && `Submitted on ${fmtDate(recentReport.createdAt)}`,
  ].filter(Boolean).join(" • ");

  const stats = [
    { title: "Property", icon: <HomeWorkIcon />, value: propertyName, caption: "Assigned Residence" },
    { title: "Room", icon: <MeetingRoomIcon />, value: tenant?.roomId || "—", caption: tenant?.bedId ? `Bed ${tenant.bedId}` : "Unit Number" },
    { title: "Monthly Rent", icon: <PaymentsIcon />, value: monthlyRent ? peso(monthlyRent) : "—", caption: paidThisMonth ? "Paid for this month" : nextDue ? `Next Due: ${fmtDate(nextDue)}` : "No due date set", onClick: () => navigate("/tenant/payments") },
    { title: "Maintenance Reports", icon: <BuildIcon />, value: activeTickets.length, caption: activeTickets.length === 1 ? "Active Request" : "Active Requests", onClick: () => navigate("/tenant/maintenance") },
  ];

  const cardSx = { borderRadius: 3, bgcolor: CREAM, border: `1px solid ${BORDER}`, minWidth: 0 };

  return (
    <Box sx={{ width: "100%", py: 1, minWidth: 0 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: { xs: 2.5, md: 3 } }}>
        <Typography sx={{ fontWeight: 700, color: INK, fontSize: { xs: "1.75rem", md: "2.125rem" }, lineHeight: 1.2 }}>
          Overview
        </Typography>
        {tenant && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Account Status:</Typography>
            <Chip
              icon={status === "Active" ? <CheckCircleIcon style={{ color: "#FFF" }} /> : undefined}
              label={status}
              color={statusTone}
              sx={{ fontWeight: 600, px: 0.5 }}
            />
          </Box>
        )}
      </Box>

      {noRecord && (
        <Paper elevation={0} sx={{ ...cardSx, p: 3, mb: 3, textAlign: "center" }}>
          <Typography fontWeight={700} color={INK}>We couldn't find your tenant record</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Ask your property owner to check that your account is registered to a room.
          </Typography>
        </Paper>
      )}

      {/* Stat cards: 2x2 on phones, 4 across on desktop */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.5, md: 3 }, mb: { xs: 2.5, md: 4 } }}>
        {stats.map((s) => (
          <Paper
            key={s.title}
            elevation={0}
            onClick={s.onClick}
            sx={{
              ...cardSx,
              p: { xs: 2, md: 3 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: { xs: 128, md: 160 },
              cursor: s.onClick ? "pointer" : "default",
              transition: "border-color .15s ease",
              "&:hover": s.onClick ? { borderColor: ORANGE } : undefined,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
              <Typography fontWeight={600} color="text.secondary" sx={{ fontSize: { xs: "0.8rem", md: "1rem" }, lineHeight: 1.3 }}>
                {s.title}
              </Typography>
              <Avatar sx={{ bgcolor: ORANGE, width: { xs: 34, md: 44 }, height: { xs: 34, md: 44 }, flexShrink: 0, "& svg": { fontSize: { xs: 18, md: 24 } } }}>
                {s.icon}
              </Avatar>
            </Box>
            <Box sx={{ mt: 2, minWidth: 0 }}>
              {loading ? (
                <>
                  <Skeleton width="60%" height={40} />
                  <Skeleton width="40%" />
                </>
              ) : (
                <>
                  <Typography noWrap fontWeight={700} color={INK} sx={{ fontSize: { xs: "1.6rem", md: "3rem" }, lineHeight: 1.2 }}>
                    {s.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                    {s.caption}
                  </Typography>
                </>
              )}
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Bottom: Maintenance report (8) + Property contact (4) */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(0, 1fr)" }, gap: { xs: 2.5, md: 3 }, alignItems: "stretch" }}>
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3.5 } }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 2.5 }}>
            <Typography variant="h6" fontWeight={700} color={INK} sx={{ fontSize: { xs: "1.05rem", md: "1.25rem" } }}>
              Recent Maintenance Report
            </Typography>
            <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate("/tenant/maintenance")} sx={{ color: ORANGE, fontWeight: 700, textTransform: "none", flexShrink: 0 }}>
              View all<Box component="span" sx={{ display: { xs: "none", sm: "inline" }, ml: 0.5 }}>reports</Box>
            </Button>
          </Box>

          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : recentReport ? (
            <Paper
              elevation={0}
              component="button"
              type="button"
              onClick={() => navigate("/tenant/maintenance")}
              sx={{
                width: "100%", textAlign: "left", font: "inherit", cursor: "pointer",
                p: { xs: 2, md: 2.5 }, borderRadius: 2, bgcolor: "#FFFFFF", border: `1px solid ${BORDER}`,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2,
                "&:hover": { borderColor: ORANGE },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={600} color={INK} noWrap sx={{ fontSize: { xs: "1rem", md: "1.25rem" } }}>
                  {reportTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {reportMeta}
                </Typography>
              </Box>
              <Chip label={recentReport.status || "Pending"} sx={{ bgcolor: ORANGE, color: "#FFFFFF", fontWeight: 700, flexShrink: 0 }} />
            </Paper>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No active maintenance reports found.
            </Typography>
          )}
        </Paper>

        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3.5 }, display: "flex", flexDirection: "column" }}>
          <Typography variant="h6" fontWeight={700} color={INK} sx={{ mb: 2, fontSize: { xs: "1.05rem", md: "1.25rem" } }}>
            Property Contact
          </Typography>

          <Box sx={{ bgcolor: "#FFFFFF", p: 2, borderRadius: 2, border: `1px solid ${BORDER}`, mb: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              ASSIGNED CARETAKER
            </Typography>
            <Typography variant="subtitle1" fontWeight={700} color={INK}>
              {caretaker ? caretaker.fullName || caretaker.name || "Caretaker" : "Not assigned yet"}
            </Typography>
            {(caretaker?.phone || emergencyPhone) && (
              <Box
                component="a"
                href={callHref(caretaker?.phone || emergencyPhone)}
                sx={{ display: "inline-flex", alignItems: "center", gap: 1, mt: 1, textDecoration: "none", color: "text.secondary" }}
              >
                <PhoneIcon fontSize="small" sx={{ color: ORANGE }} />
                <Typography variant="body2" fontWeight={600}>{caretaker?.phone || emergencyPhone}</Typography>
              </Box>
            )}
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={() => navigate("/tenant/maintenance")}
            sx={{ mt: "auto", bgcolor: ORANGE, color: "#FFFFFF", py: 1.4, fontWeight: 700, borderRadius: 2, textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#E05A2B", boxShadow: "none" } }}
          >
            + Create Maintenance Ticket
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}