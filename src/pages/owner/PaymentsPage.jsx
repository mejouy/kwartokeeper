// src/pages/owner/PaymentsPage.jsx

import React, { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  IconButton,
  Tooltip,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import PaymentsIcon from "@mui/icons-material/Payments";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import HistoryIcon from "@mui/icons-material/History";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

// ------------------------------------------------------------
// CONSTANTS + PURE HELPERS
// ------------------------------------------------------------

const row = { display: "flex", alignItems: "center" };
const BOTTOM_NAV_H = 64;
const PAYMENT_METHODS = ["GCash", "Cash", "Bank Transfer", "Maya", "Other"];
const PAYMENT_STATUSES = ["Paid", "Pending", "Partial", "Overdue"];
const MAX_AMOUNT = 10000000;

const pad = (n) => String(n).padStart(2, "0");

// Local date as yyyy-mm-dd (toISOString shifts the day back for anyone east of UTC)
const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "October 2026" — the format already stored in payments.periodMonth
const periodLabel = (date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Current month plus the 11 before it, and next month (advance payments)
const buildPeriodOptions = () => {
  const now = new Date();
  const out = [];
  for (let i = -11; i <= 1; i++) {
    out.push(periodLabel(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  return out.reverse();
};

const STATUS_TONE = {
  paid: "success",
  pending: "warning",
  overdue: "error",
  partial: "info",
  rejected: "error",
  unpaid: "default",
};

function StatusPill({ status }) {
  const tone = STATUS_TONE[String(status).toLowerCase()] || "default";
  return (
    <Chip
      label={status}
      size="small"
      sx={{
        fontWeight: 700,
        border: "none",
        bgcolor: (t) =>
          tone === "default" ? alpha(t.palette.text.primary, 0.08) : alpha(t.palette[tone].main, 0.13),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    />
  );
}

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
};

const groupShellSx = {
  ...cardSx,
  borderRadius: "12px !important",
  overflow: "hidden",
  "&:before": { display: "none" },
};

function SummaryStrip({ items }) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
        mb: { xs: 2.5, sm: 3 },
      }}
    >
      {items.map((item, i) => (
        <Box
          key={item.label}
          sx={{
            px: { xs: 1.75, sm: 2.5 },
            py: { xs: 1.5, sm: 2 },
            minWidth: 0,
            borderTop: { xs: i > 1 ? "1px solid" : "none", md: "none" },
            borderLeft: { xs: i % 2 === 1 ? "1px solid" : "none", md: i === 0 ? "none" : "1px solid" },
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
            {item.label}
          </Typography>
          <Typography
            noWrap
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.5rem" }, lineHeight: 1.25, color: item.color }}
          >
            {item.value}
          </Typography>
          {item.sub && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {item.sub}
            </Typography>
          )}
        </Box>
      ))}
    </Paper>
  );
}

function SectionTitle({ title, sub, right }) {
  return (
    <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: 1.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.3 }}>
          {title}
        </Typography>
        {sub && (
          <Typography variant="body2" color="text.secondary">
            {sub}
          </Typography>
        )}
      </Box>
      {right}
    </Box>
  );
}

export default function PaymentsPage() {
  const { currentUser } = useAuth() || {};
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openRecordPayment, setOpenRecordPayment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [processingPaymentId, setProcessingPaymentId] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [historyTenant, setHistoryTenant] = useState(null);
  const [openPaymentDetails, setOpenPaymentDetails] = useState(false);
  const [openPaymentHistory, setOpenPaymentHistory] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    tenantId: "",
    amount: "",
    paymentMethod: "GCash",
    periodMonth: "",
    status: "Paid",
    paymentDate: "",
    remarks: "",
  });

  const showToast = (message, severity = "success") => setToast({ open: true, severity, message });

  // ------------------------------------------------------------
  // CURRENT BILLING PERIOD
  // ------------------------------------------------------------

  const currentPeriodValue = useMemo(() => periodLabel(new Date()), []);
  const periodOptions = useMemo(buildPeriodOptions, []);

  // ------------------------------------------------------------
  // LOAD TENANTS, PAYMENTS AND PROPERTIES
  // ------------------------------------------------------------

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribeTenants = onSnapshot(
      query(collection(db, "tenants"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => {
        setTenants(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error loading tenants:", error);
        setLoading(false);
      }
    );

    const unsubscribePayments = onSnapshot(
      query(collection(db, "payments"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => setPayments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Error loading payments:", error)
    );

    // Property names, so two properties that both have a "Room 101" never get mixed up
    const unsubscribeProperties = onSnapshot(
      query(collection(db, "properties"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => setProperties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Error loading properties:", error)
    );

    return () => {
      unsubscribeTenants();
      unsubscribePayments();
      unsubscribeProperties();
    };
  }, [currentUser]);

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  const propertyNameById = useMemo(() => {
    const map = new Map();
    properties.forEach((p) => map.set(p.id, p.propertyName || p.name || "Unnamed property"));
    return map;
  }, [properties]);

  const normalizedTenants = useMemo(
    () =>
      tenants.map((tenant) => ({
        ...tenant,
        fullName: tenant.fullName || tenant.name || "Unnamed Tenant",
        roomNumber: tenant.roomNumber || tenant.roomId || "Unassigned",
        propertyName:
          propertyNameById.get(tenant.propertyId) || tenant.propertyName || "Dormitory",
        monthlyRent:
          Number(tenant.monthlyRent ?? tenant.rentAmount ?? tenant.monthlyRate ?? tenant.rent ?? 0) || 0,
        status: tenant.status || "Active",
      })),
    [tenants, propertyNameById]
  );

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(Number(amount) || 0);

  // Whole pesos when there are no centavos (keeps the summary strip compact)
  const formatCompact = (amount) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

  const getPaymentDate = (payment) => {
    const value = payment.paymentDate || payment.createdAt;
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (payment) => {
    const date = getPaymentDate(payment);
    if (!date) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isCurrentMonth = (payment) => {
    const date = getPaymentDate(payment);
    if (!date) return payment.periodMonth === currentPeriodValue;
    const now = new Date();

    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  const getPaymentStatus = (payment) => {
    return String(payment.status || "").toLowerCase();
  };

  const printReceipt = (payment, tenantFallback = {}) => {
    if (!payment || getPaymentStatus(payment) !== "paid") {
      alert("A receipt can only be printed for a confirmed paid transaction.");
      return;
    }

    const tenant = normalizedTenants.find((item) => item.id === payment.tenantId) || tenantFallback;
    const dateText = formatDate(payment);
    const amountText = formatCurrency(payment.amount);
    const escapeHtml = (value) =>
      String(value ?? "—").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[char]));

    const receiptWindow = window.open("", "_blank", "width=700,height=800");
    if (!receiptWindow) {
      alert("Please allow pop-ups in your browser to print the receipt.");
      return;
    }

    receiptWindow.document.write(`<!doctype html><html><head><title>Payment Receipt</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#222}
        .receipt{max-width:560px;margin:auto;border:1px solid #ddd;padding:28px}
        h1{text-align:center;font-size:22px;margin-bottom:4px}
        .sub{text-align:center;color:#666;margin-bottom:28px}
        .row{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid #eee}
        .label{color:#666}.amount{font-size:24px;font-weight:bold;text-align:center;margin:24px 0}
        .footer{text-align:center;color:#666;font-size:12px;margin-top:28px}
        @media print{body{padding:0}.receipt{border:0}}
      </style></head><body><div class="receipt">
      <h1>KWARTOKEEPER</h1><div class="sub">Payment Receipt</div>
      <div class="row"><span class="label">Receipt / Payment ID</span><span>${escapeHtml(payment.id)}</span></div>
      <div class="row"><span class="label">Tenant</span><span>${escapeHtml(payment.tenantName || tenant.fullName || tenant.name)}</span></div>
      <div class="row"><span class="label">Property</span><span>${escapeHtml(payment.propertyName || tenant.propertyName)}</span></div>
      <div class="row"><span class="label">Room</span><span>${escapeHtml(payment.roomNumber || tenant.roomNumber || tenant.roomId)}</span></div>
      <div class="row"><span class="label">Billing Period</span><span>${escapeHtml(payment.periodMonth)}</span></div>
      <div class="row"><span class="label">Payment Date</span><span>${escapeHtml(dateText)}</span></div>
      <div class="row"><span class="label">Payment Method</span><span>${escapeHtml(payment.paymentMethod)}</span></div>
      <div class="amount">${escapeHtml(amountText)}</div>
      <div class="row"><span class="label">Status</span><strong>PAID</strong></div>
      <div class="row"><span class="label">Remarks</span><span>${escapeHtml(payment.remarks)}</span></div>
      <div class="footer">Thank you. Keep this receipt for your records.</div>
      </div><script>window.onload=()=>{window.print();};</script></body></html>`);
    receiptWindow.document.close();
  };

  const openDetails = (payment) => {
    setSelectedPayment(payment || null);
    setOpenPaymentDetails(Boolean(payment));
  };

  const openHistory = (tenant) => {
    setHistoryTenant(tenant);
    setOpenPaymentHistory(true);
  };

  const paymentHistoryForTenant = useMemo(() => {
    if (!historyTenant) return [];
    return payments
      .filter((payment) => payment.tenantId === historyTenant.id)
      .sort((a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0));
  }, [payments, historyTenant]);

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------

  const totalRentCollectedThisMonth = useMemo(
    () =>
      payments
        .filter((p) => isCurrentMonth(p) && getPaymentStatus(p) === "paid")
        .reduce((total, p) => total + Number(p.amount || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, currentPeriodValue]
  );

  const expectedRent = useMemo(
    () => normalizedTenants.filter(countsTowardRent).reduce((total, t) => total + Number(t.monthlyRent || 0), 0),
    [normalizedTenants]
  );

  const pendingPayments = useMemo(
    () =>
      payments.filter((p) => {
        const s = getPaymentStatus(p);
        return s === "pending" || s === "partial";
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments]
  );

  const overduePayments = useMemo(
    () => payments.filter((p) => getPaymentStatus(p) === "overdue").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments]
  );

  const collectionRate = expectedRent > 0 ? Math.min(100, Math.round((totalRentCollectedThisMonth / expectedRent) * 100)) : null;

  // ------------------------------------------------------------
  // PENDING PAYMENT VERIFICATION
  // ------------------------------------------------------------

  const pendingVerificationPayments = useMemo(
    () =>
      [...payments]
        .filter((payment) => {
          const status = getPaymentStatus(payment);
          const verificationStatus = String(payment.verificationStatus || "").toLowerCase();
          return status === "pending" || verificationStatus === "pending";
        })
        .sort((a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments]
  );

  // ------------------------------------------------------------
  // PAYMENT STATUS FOR TENANT
  // ------------------------------------------------------------

  const getTenantPaymentInfo = (tenant) => {
    const tenantPayments = payments.filter(
      (payment) => payment.tenantId === tenant.id && payment.periodMonth === currentPeriodValue
    );

    const paidAmount = tenantPayments
      .filter((payment) => getPaymentStatus(payment) === "paid")
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);

    const latestPayment = [...tenantPayments].sort(
      (a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0)
    )[0];

    const rent = Number(tenant.monthlyRent || 0);

    let status = "Unpaid";

    if (latestPayment) {
      const paymentStatus = getPaymentStatus(latestPayment);

      if (paymentStatus === "overdue") status = "Overdue";
      else if (paidAmount >= rent && rent > 0) status = "Paid";
      else if (paidAmount > 0) status = "Partial";
      else if (paymentStatus === "pending") status = "Pending";
    }

    return {
      paidAmount,
      rent,
      balance: Math.max(rent - paidAmount, 0),
      status,
      latestPayment,
    };
  };

  // ------------------------------------------------------------
  // PROPERTY → ROOM GROUPS (keyed by property AND room)
  // ------------------------------------------------------------

  const propertyGroups = useMemo(() => {
    const props = new Map();

    normalizedTenants.forEach((tenant) => {
      const propKey = tenant.propertyId || "none";
      if (!props.has(propKey)) {
        props.set(propKey, {
          key: propKey,
          name: tenant.propertyName || "Unassigned property",
          rooms: new Map(),
          collected: 0,
          expected: 0,
          tenantCount: 0,
        });
      }
      const prop = props.get(propKey);

      const roomNumber = tenant.roomNumber || "Unassigned";
      if (!prop.rooms.has(roomNumber)) {
        prop.rooms.set(roomNumber, { roomNumber, tenants: [], collected: 0, expected: 0 });
      }
      const room = prop.rooms.get(roomNumber);

      const info = getTenantPaymentInfo(tenant);
      const expected = countsTowardRent(tenant) ? info.rent : 0;

      room.tenants.push({ tenant, info });
      room.collected += info.paidAmount;
      room.expected += expected;
      prop.collected += info.paidAmount;
      prop.expected += expected;
      prop.tenantCount += 1;
    });

    return [...props.values()]
      .map((prop) => ({
        ...prop,
        rooms: [...prop.rooms.values()].sort((a, b) =>
          String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedTenants, payments, currentPeriodValue]);

  // ------------------------------------------------------------
  // PAYMENT VERIFICATION
  // ------------------------------------------------------------

  const handleVerifyPayment = async (paymentId, approved) => {
    if (!currentUser?.uid || !paymentId) {
      showToast("Unable to update this payment.", "error");
      return;
    }

    const payment = payments.find((item) => item.id === paymentId);

    if (!payment) {
      showToast("Payment could not be found.", "error");
      return;
    }

    if (payment.ownerUid && payment.ownerUid !== currentUser.uid) {
      showToast("You are not authorized to update this payment.", "error");
      return;
    }

    setProcessingPaymentId(paymentId);

    try {
      await updateDoc(doc(db, "payments", paymentId), {
        status: approved ? "Paid" : "Rejected",
        verificationStatus: approved ? "Approved" : "Rejected",
        verifiedAt: new Date(),
        verifiedBy: currentUser.uid,
      });
      // Tell the tenant (best effort: the approval above already went through)
      if (payment.tenantId) {
        addDoc(collection(db, "notifications"), {
          userId: payment.tenantId,
          kind: "payment",
          category: "payment",
          paymentId,
          type: approved ? "success" : "error",
          title: approved ? "Payment received" : "Payment rejected",
          message: approved
            ? `Your ${formatCurrency(payment.amount)} rent payment for ${payment.periodMonth || "this month"} was verified. Thank you!`
            : `Your ${formatCurrency(payment.amount)} payment for ${payment.periodMonth || "this month"} couldn't be verified. Please check the details or ask your landlord, then submit it again.`,
          ownerId: currentUser.uid,
          createdBy: currentUser.uid,
          createdByRole: "owner",
          isRead: false,
          createdAt: new Date().toISOString(),
        }).catch((err) => console.warn("Payment notice failed:", err?.code || err));
      }
      showToast(approved ? "Payment approved." : "Payment rejected.");
    } catch (error) {
      console.error("Error verifying payment:", error);
      showToast(
        approved
          ? "Failed to approve the payment. Please try again."
          : "Failed to reject the payment. Please try again.",
        "error"
      );
    } finally {
      setProcessingPaymentId("");
    }
  };

  // ------------------------------------------------------------
  // RECORD PAYMENT
  // ------------------------------------------------------------

  const handleOpenRecordPayment = () => {
    setPaymentForm({
      tenantId: "",
      amount: "",
      paymentMethod: "GCash",
      periodMonth: currentPeriodValue,
      status: "Paid",
      paymentDate: todayInput(),
      remarks: "",
    });
    setFormErrors({});
    setOpenRecordPayment(true);
  };

  const handleCloseRecordPayment = () => {
    if (saving) return;
    setOpenRecordPayment(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setFormErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

    setPaymentForm((prev) => {
      const next = { ...prev, [name]: value };

      // Picking a tenant suggests what they still owe this month (only if nothing typed yet)
      if (name === "tenantId" && !prev.amount) {
        const tenant = normalizedTenants.find((t) => t.id === value);
        if (tenant) {
          const { balance } = getTenantPaymentInfo(tenant);
          if (balance > 0) next.amount = String(balance);
        }
      }
      return next;
    });
  };

  const validateForm = () => {
    const e = {};
    if (!paymentForm.tenantId) e.tenantId = "Select a tenant.";

    const amount = Number(paymentForm.amount);
    if (paymentForm.amount === "" || Number.isNaN(amount) || amount <= 0) e.amount = "Enter an amount greater than 0.";
    else if (amount > MAX_AMOUNT) e.amount = "That amount looks too large.";
    else if (!/^\d+(\.\d{1,2})?$/.test(String(paymentForm.amount).trim())) e.amount = "Use at most 2 decimal places.";

    if (!paymentForm.periodMonth) e.periodMonth = "Select a billing period.";

    if (!paymentForm.paymentDate) e.paymentDate = "Choose the payment date.";
    else if (Number.isNaN(new Date(`${paymentForm.paymentDate}T12:00:00`).getTime())) e.paymentDate = "Enter a valid date.";

    if (paymentForm.remarks.length > 300) e.remarks = "Keep notes under 300 characters.";
    return e;
  };

  const handleRecordPayment = async () => {
    if (saving) return;

    if (!currentUser?.uid) {
      showToast("You must be logged in to record a payment.", "error");
      return;
    }

    const errs = validateForm();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const selectedTenant = normalizedTenants.find((tenant) => tenant.id === paymentForm.tenantId);

    if (!selectedTenant) {
      setFormErrors({ tenantId: "That tenant could not be found." });
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "payments"), {
        tenantId: selectedTenant.id,
        tenantName: selectedTenant.fullName,
        propertyId: selectedTenant.propertyId || selectedTenant.assignedPropertyId || "",
        propertyName: selectedTenant.propertyName || "Dormitory",
        roomNumber: selectedTenant.roomNumber || "N/A",
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        periodMonth: paymentForm.periodMonth,
        status: paymentForm.status,
        verificationStatus:
          paymentForm.status === "Paid" ? "Approved" : paymentForm.status === "Pending" ? "Pending" : "",
        remarks: paymentForm.remarks.trim(),
        ownerUid: currentUser.uid,
        paymentDate: new Date(`${paymentForm.paymentDate}T12:00:00`),
        createdAt: serverTimestamp(),
      });

      setOpenRecordPayment(false);
      showToast(`Payment recorded for ${selectedTenant.fullName}.`);
    } catch (error) {
      console.error("Error recording payment:", error);
      setFormErrors({ _form: "Failed to record payment. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const selectedFormTenant = normalizedTenants.find((t) => t.id === paymentForm.tenantId);
  const selectedFormInfo = selectedFormTenant ? getTenantPaymentInfo(selectedFormTenant) : null;

  // ------------------------------------------------------------
  // TENANT ROW (grid on laptops, compact card on phones)
  // ------------------------------------------------------------

  const COLS = "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 100px";

  const renderTenantRow = ({ tenant, info }) => {
    const dim = !countsTowardRent(tenant);
    return (
      <Box
        key={tenant.id}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: COLS },
          alignItems: "center",
          columnGap: 2,
          rowGap: 0.5,
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, md: 1.5 },
          opacity: dim ? 0.65 : 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
            {tenant.fullName}
          </Typography>
          {dim && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {String(tenant.status).toLowerCase().startsWith("pending") ? "Pending onboarding" : tenant.status}
            </Typography>
          )}
        </Box>

        {/* Phones: status top right */}
        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <StatusPill status={info.status} />
        </Box>

        {/* Phones: one quiet money line */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: { xs: "block", md: "none" }, gridColumn: "1 / -1" }}
        >
          Rent {formatCompact(info.rent)} · Paid{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{formatCompact(info.paidAmount)}</Box>
          {" "}· Balance{" "}
          <Box component="span" sx={{ color: info.balance > 0 && !dim ? "warning.dark" : "text.primary", fontWeight: 600 }}>
            {formatCompact(info.balance)}
          </Box>
        </Typography>

        {/* Laptops */}
        <Typography variant="body2" sx={{ display: { xs: "none", md: "block" } }}>{formatCurrency(info.rent)}</Typography>
        <Typography variant="body2" sx={{ display: { xs: "none", md: "block" }, fontWeight: 600 }}>
          {formatCurrency(info.paidAmount)}
        </Typography>
        <Typography
          variant="body2"
          sx={{ display: { xs: "none", md: "block" }, fontWeight: 600, color: info.balance > 0 && !dim ? "warning.dark" : "text.primary" }}
        >
          {formatCurrency(info.balance)}
        </Typography>
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <StatusPill status={info.status} />
        </Box>
      </Box>
    );
  };

  const columnHeader = (
    <Box
      sx={{
        display: { xs: "none", md: "grid" },
        gridTemplateColumns: COLS,
        columnGap: 2,
        px: 3,
        py: 1,
        bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
        borderBottom: "1px solid",
        borderColor: "divider",
        "& > *": { fontWeight: 700, color: "text.secondary", fontSize: "0.75rem", letterSpacing: 0.3 },
      }}
    >
      <Box>TENANT</Box>
      <Box>MONTHLY RENT</Box>
      <Box>COLLECTED</Box>
      <Box>BALANCE</Box>
      <Box>STATUS</Box>
    </Box>
  );

  // ------------------------------------------------------------
  // LOADING
  // ------------------------------------------------------------

  if (loading) {
    return (
      <Box sx={{ minWidth: 0 }}>
        <Skeleton variant="rounded" height={84} sx={{ borderRadius: 3, mb: 3 }} />
        {[0, 1].map((i) => (
          <Paper key={i} elevation={0} sx={{ ...groupShellSx, p: 2, mb: 2 }}>
            <Skeleton width="35%" height={28} />
            <Skeleton variant="rounded" height={52} sx={{ mt: 1.5 }} />
            <Skeleton variant="rounded" height={52} sx={{ mt: 1 }} />
          </Paper>
        ))}
      </Box>
    );
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <Box sx={{ minWidth: 0, pb: { xs: 9, sm: 0 } }}>
      {/* The top bar already says "Payments", so the page adds a line of context and the main action */}
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography color="text.secondary" sx={{ minWidth: 0 }}>
          Monitor rent collection and payment status by room · {currentPeriodValue}
        </Typography>
        <Button
          variant="contained"
          disableElevation
          startIcon={<AddIcon />}
          onClick={handleOpenRecordPayment}
          sx={{ flexShrink: 0, fontWeight: 700, borderRadius: 2.5, display: { xs: "none", sm: "inline-flex" } }}
        >
          Record payment
        </Button>
      </Box>

      <SummaryStrip
        items={[
          {
            label: "Collected this month",
            value: formatCompact(totalRentCollectedThisMonth),
            sub: collectionRate !== null ? `${collectionRate}% of expected` : "No expected rent yet",
            color: "success.main",
          },
          { label: "Expected rent", value: formatCompact(expectedRent), sub: "Active tenants" },
          {
            label: "Pending",
            value: pendingPayments,
            color: pendingPayments > 0 ? "warning.main" : undefined,
            sub: pendingPayments === 1 ? "payment" : "payments",
          },
          {
            label: "Overdue",
            value: overduePayments,
            color: overduePayments > 0 ? "error.main" : undefined,
            sub: overduePayments === 1 ? "payment" : "payments",
          },
        ]}
      />

      {/* ======================================================
          PENDING PAYMENT VERIFICATION
      ====================================================== */}

      {pendingVerificationPayments.length > 0 && (
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <SectionTitle
            title="Needs your review"
            sub="Payments submitted by tenants. Approve them to mark as paid."
            right={
              <Chip
                size="small"
                label={pendingVerificationPayments.length}
                sx={{ fontWeight: 800, bgcolor: (t) => alpha(t.palette.warning.main, 0.16), color: "warning.dark" }}
              />
            }
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {pendingVerificationPayments.map((payment) => {
              const isProcessing = processingPaymentId === payment.id;

              return (
                <Paper
                  key={payment.id}
                  elevation={0}
                  sx={{ ...cardSx, p: { xs: 2, sm: 2.5 }, borderLeft: "3px solid", borderLeftColor: "warning.main" }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      alignItems: { xs: "stretch", md: "center" },
                      justifyContent: "space-between",
                      gap: { xs: 1.5, md: 3 },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {payment.tenantName || "Unnamed Tenant"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        Room {payment.roomNumber || "Unassigned"} • {payment.propertyName || "Dormitory"}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                        <Chip label={payment.paymentMethod || "Unknown method"} size="small" variant="outlined" />
                        <Chip label={payment.periodMonth || "No billing period"} size="small" variant="outlined" />
                      </Box>
                    </Box>

                    <Box sx={{ textAlign: { xs: "left", md: "right" }, minWidth: { md: 150 } }}>
                      <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.25rem" }}>
                        {formatCurrency(payment.amount)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{formatDate(payment)}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                      <Button
                        variant="contained"
                        color="success"
                        disableElevation
                        disabled={isProcessing}
                        onClick={() => handleVerifyPayment(payment.id, true)}
                        startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                        sx={{ flex: { xs: 1, md: "none" }, fontWeight: 700 }}
                      >
                        {isProcessing ? "Updating…" : "Approve"}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={isProcessing}
                        onClick={() => setRejectTarget(payment)}
                        sx={{ flex: { xs: 1, md: "none" }, fontWeight: 700 }}
                      >
                        Reject
                      </Button>
                    </Box>
                  </Box>

                  {(payment.referenceNumber || payment.remarks || payment.proofUrl || payment.recordedByName) && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        {payment.referenceNumber && (
                          <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                            <strong>Reference:</strong> {payment.referenceNumber}
                          </Typography>
                        )}
                        {payment.remarks && (
                          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                            <strong>Remarks:</strong> {payment.remarks}
                          </Typography>
                        )}
                        {payment.recordedByName && (
                          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                            <strong>Recorded by:</strong> {payment.recordedByName}
                            {payment.recordedByRole ? ` (${payment.recordedByRole})` : ""}
                          </Typography>
                        )}
                        {payment.proofUrl && (
                          <Box component="a" href={payment.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 0.75 }}>
                            <Box component="img" src={payment.proofUrl} alt="Proof of payment" loading="lazy" sx={{ display: "block", width: 120, height: 120, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                          </Box>
                        )}
                      </Box>
                    </>
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ======================================================
          PAYMENT MANAGEMENT
      ====================================================== */}

      <SectionTitle title="Rent by room" sub={`Billing period: ${currentPeriodValue}`} />

      {propertyGroups.length === 0 ? (
        <Paper elevation={0} sx={{ ...groupShellSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <PaymentsOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Nothing to collect yet</Typography>
          <Typography variant="body2" color="text.secondary">
            Register tenants and assign them rooms to track rent here.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {propertyGroups.map((prop, index) => {
            const pct = prop.expected > 0 ? Math.min(100, Math.round((prop.collected / prop.expected) * 100)) : 0;
            return (
              <Accordion key={prop.key} defaultExpanded={index === 0} disableGutters elevation={0} sx={groupShellSx}>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ "& .MuiAccordionSummary-content": { alignItems: "center", my: 1.5, minWidth: 0 } }}
                >
                  <Box sx={{ ...row, gap: 1.5, minWidth: 0, flex: 1 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                      <ApartmentOutlinedIcon color="primary" fontSize="small" />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                        {prop.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {prop.tenantCount} {prop.tenantCount === 1 ? "tenant" : "tenants"} ·{" "}
                        {formatCompact(prop.collected)} of {formatCompact(prop.expected)}
                      </Typography>
                    </Box>
                    <Box sx={{ width: { xs: 48, sm: 120 }, flexShrink: 0, mr: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        color={pct >= 100 ? "success" : "primary"}
                        sx={{ height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" }, mt: 0.25, textAlign: "right" }}>
                        {pct}%
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>

              {/* ROOM TENANTS */}
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  {room.tenants.map((tenant) => {
                    const info =
                      getTenantPaymentInfo(tenant);

                    return (
                      <Box key={tenant.id}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: {
                              xs: "flex-start",
                              md: "center",
                            },
                            flexDirection: {
                              xs: "column",
                              md: "row",
                            },
                            gap: 2,
                          }}
                        >
                          <Box sx={{ minWidth: 180 }}>
                            <Typography
                              fontWeight={600}
                            >
                              {tenant.fullName}
                            </Typography>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {tenant.propertyName}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Monthly Rent
                            </Typography>

                            <Typography
                              fontWeight={600}
                            >
                              {formatCurrency(info.rent)}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Amount Collected
                            </Typography>

                            <Typography
                              fontWeight={600}
                            >
                              {formatCurrency(
                                info.paidAmount
                              )}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Balance
                            </Typography>

                            <Typography
                              fontWeight={600}
                            >
                              {formatCurrency(
                                info.balance
                              )}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "block",
                                mb: 0.5,
                              }}
                            >
                              Status
                            </Typography>

                            {renderStatusChip(info.status)}
                          </Box>

                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Tooltip title={info.latestPayment ? "View payment" : "No payment recorded"}>
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label="View payment"
                                  disabled={!info.latestPayment}
                                  onClick={() => openDetails(info.latestPayment)}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="View payment history">
                              <IconButton
                                size="small"
                                aria-label="View payment history"
                                onClick={() => openHistory(tenant)}
                              >
                                <HistoryIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={info.latestPayment && getPaymentStatus(info.latestPayment) === "paid" ? "Print receipt" : "Receipt available for paid transactions"}>
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label="Print receipt"
                                  disabled={!info.latestPayment || getPaymentStatus(info.latestPayment) !== "paid"}
                                  onClick={() => printReceipt(info.latestPayment, tenant)}
                                >
                                  <PrintIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* ROOM TOTAL */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Room Total
                  </Typography>

                  <Typography
                    fontWeight={700}
                  >
                    {formatCurrency(room.collected)}{" "}
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                    >
                      / {formatCurrency(room.expected)}
                    </Typography>
                  </Typography>
                </Box>
              </Box>
            </Card>
          ))}
        </Stack>
      )}

      {/* PAYMENT DETAILS DIALOG */}
      <Dialog
        open={openPaymentDetails}
        onClose={() => setOpenPaymentDetails(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Payment Details
          <IconButton onClick={() => setOpenPaymentDetails(false)} aria-label="Close payment details">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPayment && (
            <Stack spacing={1.5}>
              {[
                ["Tenant", selectedPayment.tenantName || "—"],
                ["Property", selectedPayment.propertyName || "—"],
                ["Room", selectedPayment.roomNumber || "—"],
                ["Billing Period", selectedPayment.periodMonth || "—"],
                ["Payment Date", formatDate(selectedPayment)],
                ["Amount", formatCurrency(selectedPayment.amount)],
                ["Payment Method", selectedPayment.paymentMethod || "—"],
                ["Status", selectedPayment.status || "—"],
                ["Reference Number", selectedPayment.referenceNumber || "—"],
                ["Remarks", selectedPayment.remarks || "—"],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography fontWeight={600} sx={{ textAlign: "right", overflowWrap: "anywhere" }}>{value}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPaymentDetails(false)}>Close</Button>
          <Button
            startIcon={<PrintIcon />}
            variant="contained"
            disabled={!selectedPayment || getPaymentStatus(selectedPayment) !== "paid"}
            onClick={() => printReceipt(selectedPayment)}
          >
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>

      {/* TENANT PAYMENT HISTORY DIALOG */}
      <Dialog
        open={openPaymentHistory}
        onClose={() => setOpenPaymentHistory(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Payment History{historyTenant ? ` — ${historyTenant.fullName}` : ""}
          <IconButton onClick={() => setOpenPaymentHistory(false)} aria-label="Close payment history">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {paymentHistoryForTenant.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              No payment records found for this tenant.
            </Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 650 }}>
                <Stack direction="row" sx={{ px: 1, py: 1, bgcolor: "action.hover" }}>
                  <Typography sx={{ flex: 1 }} fontWeight={700}>Date / Period</Typography>
                  <Typography sx={{ flex: 1 }} fontWeight={700}>Amount</Typography>
                  <Typography sx={{ flex: 1 }} fontWeight={700}>Method</Typography>
                  <Typography sx={{ flex: 1 }} fontWeight={700}>Status</Typography>
                  <Typography sx={{ width: 90 }} fontWeight={700}>Actions</Typography>
                </Stack>
                {paymentHistoryForTenant.map((payment) => (
                  <Stack key={payment.id} direction="row" alignItems="center" sx={{ px: 1, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{formatDate(payment)}</Typography>
                      <Typography variant="caption" color="text.secondary">{payment.periodMonth || "—"}</Typography>
                    </Box>
                    <Typography sx={{ flex: 1 }}>{formatCurrency(payment.amount)}</Typography>
                    <Typography sx={{ flex: 1 }}>{payment.paymentMethod || "—"}</Typography>
                    <Box sx={{ flex: 1 }}>{renderStatusChip(payment.status || "Paid")}</Box>
                    <Stack direction="row" sx={{ width: 90 }}>
                      <Tooltip title="View payment">
                        <IconButton size="small" onClick={() => { setOpenPaymentHistory(false); openDetails(payment); }}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={getPaymentStatus(payment) === "paid" ? "Print receipt" : "Only paid transactions can be printed"}>
                        <span>
                          <IconButton size="small" disabled={getPaymentStatus(payment) !== "paid"} onClick={() => printReceipt(payment, historyTenant)}>
                            <PrintIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPaymentHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          RECORD PAYMENT MODAL (full-screen on phones)
      ====================================================== */}

      <Dialog
        open={openRecordPayment}
        onClose={handleCloseRecordPayment}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 3 } } }}
      >
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          Record payment
          <IconButton onClick={handleCloseRecordPayment} size="small" aria-label="Close" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {formErrors._form && <Alert severity="error" sx={{ mb: 2.5 }}>{formErrors._form}</Alert>}

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.25 }}>
            {/* TENANT */}
            <TextField
              select
              required
              fullWidth
              label="Tenant"
              name="tenantId"
              value={paymentForm.tenantId}
              onChange={handleFormChange}
              error={Boolean(formErrors.tenantId)}
              helperText={
                formErrors.tenantId ||
                (selectedFormInfo
                  ? `Rent ${formatCompact(selectedFormInfo.rent)} · Paid ${formatCompact(selectedFormInfo.paidAmount)} · Balance ${formatCompact(selectedFormInfo.balance)} this month`
                  : "")
              }
              sx={{ gridColumn: { sm: "1 / -1" } }}
            >
              {[...normalizedTenants]
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.fullName} — Room {tenant.roomNumber}
                  </MenuItem>
                ))}
            </TextField>

            {/* AMOUNT */}
            <TextField
              required
              fullWidth
              label="Amount"
              name="amount"
              type="number"
              value={paymentForm.amount}
              onChange={handleFormChange}
              error={Boolean(formErrors.amount)}
              helperText={formErrors.amount || ""}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> },
                htmlInput: { min: 0, step: "0.01", inputMode: "decimal" },
              }}
            />

            {/* PAYMENT METHOD */}
            <TextField select fullWidth label="Payment method" name="paymentMethod" value={paymentForm.paymentMethod} onChange={handleFormChange}>
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </TextField>

            {/* BILLING PERIOD */}
            <TextField
              select
              required
              fullWidth
              label="Billing period"
              name="periodMonth"
              value={paymentForm.periodMonth}
              onChange={handleFormChange}
              error={Boolean(formErrors.periodMonth)}
              helperText={formErrors.periodMonth || ""}
            >
              {periodOptions.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>

            {/* PAYMENT DATE */}
            <TextField
              required
              fullWidth
              label="Payment date"
              name="paymentDate"
              type="date"
              value={paymentForm.paymentDate}
              onChange={handleFormChange}
              error={Boolean(formErrors.paymentDate)}
              helperText={formErrors.paymentDate || ""}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {/* STATUS */}
            <TextField
              select
              fullWidth
              label="Status"
              name="status"
              value={paymentForm.status}
              onChange={handleFormChange}
              helperText={paymentForm.status === "Paid" ? "Counts toward rent collected right away." : ""}
              sx={{ gridColumn: { sm: "1 / -1" } }}
            >
              {PAYMENT_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>

            {/* REMARKS */}
            <TextField
              fullWidth
              label="Remarks"
              name="remarks"
              value={paymentForm.remarks}
              onChange={handleFormChange}
              multiline
              minRows={2}
              placeholder="Optional payment notes"
              error={Boolean(formErrors.remarks)}
              helperText={formErrors.remarks || `${paymentForm.remarks.length}/300`}
              sx={{ gridColumn: { sm: "1 / -1" } }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleCloseRecordPayment} color="inherit" disabled={saving} sx={{ fontWeight: 600, flex: { xs: 1, sm: "none" } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleRecordPayment}
            disabled={saving}
            sx={{ px: 4, py: 1.1, fontWeight: 700, flex: { xs: 1, sm: "none" } }}
          >
            {saving ? <CircularProgress size={22} color="inherit" /> : "Save payment"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `calc(${BOTTOM_NAV_H + 8}px + env(safe-area-inset-bottom, 0px)) !important`, sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}