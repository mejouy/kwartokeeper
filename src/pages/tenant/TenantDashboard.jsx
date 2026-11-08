// src/pages/tenant/TenantDashboard.jsx
//
// One file for the whole tenant area, designed phone-first. TenantLayout decides
// which tab is open and passes it in as `activeTab` ("overview" | "payments" |
// "profile" | "maintenance").

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Fab, IconButton, LinearProgress, Paper, Skeleton, Snackbar, TextField, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import PaymentIcon from "@mui/icons-material/Payment";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import IosShareOutlinedIcon from "@mui/icons-material/IosShareOutlined";
import WifiOffOutlinedIcon from "@mui/icons-material/WifiOffOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, collection, addDoc, updateDoc, arrayUnion, query, where, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { notifyMaintenanceSubmitted, notifyMaintenanceCancelled, notifyMaintenanceFollowUp, notifyPaymentSubmitted } from "../../services/notificationService";
import { normalizePayment } from "../../utils/normalizePayment";
import { saveReceiptImage } from "../../utils/receiptImage";
import { leaseLengthText } from "../../utils/tenantRent";
import { billSnapshot, chargeAppliesTo, isActiveCharge, monthBill } from "../../utils/charges";
import { BillBreakdown } from "../../components/Fees";
import { addMonthsClamped } from "../../utils/addMonthsClamped";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { getPropertyCoverPhotoUrl } from "../../utils/getPropertyCoverPhotoUrl";
import { CATEGORIES, rankMaintenanceRequests } from "../../utils/maintenancePrioritization";
import { ADVANCE_MONTHS, periodLabel, shortPeriod, periodsText, PAGE_SIZE, ANNOUNCE_PREVIEW, BOTTOM_NAV_H, row, cardSx, CATEGORY_OPTIONS, readPayMethods, prettyMobile, peso, getTodayInputValue, getTimestampMillis, fmtDate, LEASE_MONTHS, formatLeaseDuration, paymentTone, AnimationStyles, Pill, EmptyState, Facts, useToday, readOutbox, writeOutbox, useOnline, PhotoPicker, TabErrorBoundary, saveImage, parseClock, useClock } from "./tenantParts";
import TenantOverviewTab from "./TenantOverviewTab";
import TenantPaymentsTab from "./TenantPaymentsTab";
import TenantProfileTab from "./TenantProfileTab";
import TenantMaintenanceTab from "./TenantMaintenanceTab";
import { t } from "../../i18n";

export default function TenantDashboard({ activeTab = "overview", onNavigateTab }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  const goTab = (id) => {
    if (onNavigateTab) onNavigateTab(id);
    else navigate({ hash: id === "overview" ? "" : `#${id}` });
  };

  const [loading, setLoading] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setToast({ open: true, message, severity });
  const online = useOnline();
  const today = useToday();
  const [loadError, setLoadError] = useState("");
  const [listenError, setListenError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const retryLoad = () => {
    setLoading(true);
    setLoadError("");
    setListenError(false);
    setReloadKey((k) => k + 1);
  };

  // ---- tenant info
  const [tenantInfo, setTenantInfo] = useState({
    name: "Tenant",
    propertyName: "Not Assigned",
    roomNumber: "N/A",
    bedId: "N/A",
    monthlyRent: 0,
    status: "Active",
    leaseStartDate: "Not specified",
    leaseEndDate: "",
    leaseMonths: null,
    leaseDuration: "Not specified",
    contact: "None provided",
    ownerUid: "",
    propertyId: "",
    propertyAddress: "",
    coverPhotoUrl: "",
    curfewTime: "",
    rules: [],
    ruleFiles: [],
    amenities: [],
    emergencyPhone: "",
    rentDueDay: 5,
  });
  const [announcements, setAnnouncements] = useState([]);
  const [curfewRecords, setCurfewRecords] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const flushing = useRef(false);
  const [ticketDlg, setTicketDlg] = useState({ mode: "", ticket: null, title: "", description: "", text: "", photo: null, photoError: "", busy: false, error: "" });

  // ---- maintenance
  const [tickets, setTickets] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openRepairModal, setOpenRepairModal] = useState(false);
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [repairTouched, setRepairTouched] = useState(false);
  const [repairForm, setRepairForm] = useState({ title: "", description: "", category: CATEGORIES.SAFETY });
  const [repairPhoto, setRepairPhoto] = useState(null);
  const [repairPhotoError, setRepairPhotoError] = useState("");

  // ---- payments
  const [payments, setPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [proofFile, setProofFile] = useState(null);
  const [proofError, setProofError] = useState("");
  const [announcementsShown, setAnnouncementsShown] = useState(ANNOUNCE_PREVIEW);
  const [announcementFilter, setAnnouncementFilter] = useState("all");
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [ticketFilter, setTicketFilter] = useState("all");
  const [ticketsShown, setTicketsShown] = useState(PAGE_SIZE);
  const [archiveShown, setArchiveShown] = useState(PAGE_SIZE);
  const [coverFailed, setCoverFailed] = useState(false);
  const [rulesAckedSig, setRulesAckedSig] = useState("");
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [payStep, setPayStep] = useState(0); // 0 pay, 1 details, 2 done
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentTouched, setPaymentTouched] = useState({});
  const [paymentForm, setPaymentForm] = useState({ amount: "", referenceNumber: "", paymentDate: getTodayInputValue(), remarks: "" });
  const [paymentError, setPaymentError] = useState("");
  const [payMonths, setPayMonths] = useState([]); // period labels being paid in this submission
  const [submittedPayment, setSubmittedPayment] = useState(null);
  const [receipt, setReceipt] = useState(null);
  // Extra fees the owner added (electricity, Wi-Fi...), on top of rent
  const [charges, setCharges] = useState([]);

  // ---- billing period / due date
  const currentPeriod = useMemo(() => today.toLocaleDateString("en-US", { month: "long", year: "numeric" }), [today]);

  // What one month costs: rent + that month's fees, less what was received
  const billFor = useCallback(
    (label) =>
      monthBill(
        Number(tenantInfo.monthlyRent) || 0,
        charges.filter((c) => chargeAppliesTo(c, label)),
        payments.filter((p) => String(p.periodMonth || "").trim().toLowerCase() === String(label).toLowerCase())
      ),
    [charges, payments, tenantInfo.monthlyRent]
  );
  const currentBill = billFor(currentPeriod);
  // Rent marked paid, but fees added for the month are still open
  const feesOutstanding = currentBill.hasPaid && currentBill.balance > 0;

  const dueDate = useMemo(() => {
    const day = Math.min(Math.max(Number(tenantInfo.rentDueDay || 5), 1), 28);
    return new Date(today.getFullYear(), today.getMonth(), day);
  }, [tenantInfo.rentDueDay, today]);

  const dueDateLabel = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const currentPeriodPayment = useMemo(() => {
    const periodPayments = payments.filter((p) => p.periodMonth === currentPeriod);
    const is = (p, ...names) => names.includes(String(p.status || "").toLowerCase());
    // Paid wins, then anything waiting for the owner, then the newest (e.g. a rejected one).
    return periodPayments.find((p) => is(p, "paid")) || periodPayments.find((p) => is(p, "pending", "pending verification")) || periodPayments[0] || null;
  }, [payments, currentPeriod]);

  const daysToDue = useMemo(() => {
    const midnight = new Date(today);
    midnight.setHours(0, 0, 0, 0);
    return Math.round((dueDate.getTime() - midnight.getTime()) / 86400000);
  }, [dueDate, today]);

  // Unpaid and past the due date reads as "Overdue"
  const rentStatus = currentBill.settled
    ? "Paid"
    : currentBill.pending
      ? "Pending"
      : feesOutstanding
        ? "Partial"
        : currentPeriodPayment?.status || (daysToDue < 0 ? "Overdue" : "Unpaid");
  // Still to pay this month (the full bill when nothing was paid yet)
  const dueNow = currentBill.balance > 0 ? currentBill.balance : currentBill.total;
  const statusKey = String(rentStatus).toLowerCase();
  const isPaid = statusKey === "paid";
  const isAwaitingVerification = ["pending", "pending verification"].includes(statusKey);
  const canPay = !isPaid && !isAwaitingVerification;
  const rentMissing = !(Number(tenantInfo.monthlyRent) > 0);

  const dueText = isPaid
    ? t("Paid for this month")
    : isAwaitingVerification
      ? t("Waiting for owner to verify")
      : daysToDue < 0
        ? t("Overdue by {days}", { days: Math.abs(daysToDue) === 1 ? t("{n} day", { n: Math.abs(daysToDue) }) : t("{n} days", { n: Math.abs(daysToDue) }) })
        : daysToDue === 0
          ? t("Due today")
          : t("Due in {days}", { days: daysToDue === 1 ? t("{n} day", { n: daysToDue }) : t("{n} days", { n: daysToDue }) });

  // ---- lease progress
  const lease = useMemo(() => {
    const startMs = getTimestampMillis(tenantInfo.leaseStartDate);
    if (!startMs) return null;
    let endMs = getTimestampMillis(tenantInfo.leaseEndDate);
    if (!endMs && tenantInfo.leaseMonths) {
      endMs = addMonthsClamped(new Date(startMs), tenantInfo.leaseMonths)?.getTime() || 0;
    }
    const now = today.getTime();
    if (!endMs || endMs <= startMs) {
      const monthsIn = Math.max(0, Math.floor((now - startMs) / (30.44 * 86400000)));
      return { open: true, monthsIn, startMs };
    }
    const progress = Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs)));
    const daysLeft = Math.ceil((endMs - now) / 86400000);
    return { open: false, startMs, endMs, progress, daysLeft, ended: daysLeft < 0 };
  }, [tenantInfo.leaseStartDate, tenantInfo.leaseEndDate, tenantInfo.leaseMonths, today]);

  // ---- months the tenant can pay: this month and up to ADVANCE_MONTHS ahead, not past the lease end
  const payableMonths = useMemo(() => {
    const leaseEnd = lease && !lease.open ? lease.endMs : null;
    const statusFor = (label) => {
      const list = payments.filter((p) => String(p.periodMonth || "").trim().toLowerCase() === label.toLowerCase());
      const s = (p) => String(p.status || "").toLowerCase();
      const bill = billFor(label);
      if (bill.settled) return "paid";
      if (list.some((p) => ["pending", "pending verification"].includes(s(p)))) return "pending";
      // Rent paid but fees still open counts as part-paid
      if (bill.received > 0 || list.some((p) => s(p) === "paid" || s(p) === "partial")) return bill.balance > 0 ? "partial" : "paid";
      return "open";
    };
    const out = [];
    for (let i = 0; i <= ADVANCE_MONTHS; i += 1) {
      const first = new Date(today.getFullYear(), today.getMonth() + i, 1);
      if (leaseEnd && first.getTime() > leaseEnd) break;
      const label = periodLabel(first);
      out.push({ label, short: shortPeriod(label), current: i === 0, status: statusFor(label), due: billFor(label).balance });
    }
    return out;
  }, [payments, today, lease, billFor]);
  const openMonths = payableMonths.filter((m) => m.status === "open" || m.status === "partial");
  // Already paid (or sent) for months after this one
  const aheadMonths = payableMonths.filter((m) => !m.current && (m.status === "paid" || m.status === "pending"));
  const canPayAhead = !canPay && openMonths.some((m) => !m.current);

  // ---- load tenant profile + realtime listeners
  // Waits for Firebase to restore the session (auth.currentUser is null for a
  // moment after a reload, which used to bounce people to the login page).
  useEffect(() => {
    let cancelled = false;
    let unsubs = [];

    // The tenant's details, live: their profile (users), the owner's tenant record
    // (tenants) and their property. Anything the owner or caretaker changes (rent,
    // lease, room, status, house rules, curfew, payment accounts) shows right away.
    const loadProfile = (user) => {
      const latest = { user: undefined, tenant: undefined, prop: undefined, propId: null };
      let unsubProp = null;

      const build = () => {
        if (cancelled) return;
        // Wait for the first answer from both records
        if (latest.user === undefined || latest.tenant === undefined) return;
        if (!latest.user && !latest.tenant) {
          setLoadError("We couldn't find your tenant profile. Please contact your landlord.");
          setLoading(false);
          return;
        }
        // Same rule as the owner's and caretaker's screens: the owner's tenant record wins
        // where both have a value (the owner saves both together anyway)
        const data = { ...(latest.user || {}), ...(latest.tenant || {}) };
        const propertyId = data.propertyId || data.assignedPropertyId || "";

        // Moved to another property (or first load): follow the new one
        if (propertyId !== latest.propId) {
          if (unsubProp) unsubProp();
          unsubProp = null;
          latest.propId = propertyId;
          latest.prop = propertyId ? undefined : null;
          if (propertyId) {
            unsubProp = onSnapshot(
              doc(db, "properties", propertyId),
              (snap) => {
                latest.prop = snap.exists() ? { id: snap.id, ...snap.data() } : null;
                build();
              },
              (err) => {
                console.error("Error fetching property doc:", err);
                latest.prop = null;
                build();
              }
            );
            return;
          }
        }
        if (latest.prop === undefined) return;

        let propertyName = "Not Assigned";
        let propertyAddress = "";
        let assignedRoom = null;
        let propExtras = {};
        const propData = latest.prop;
        if (propData) {
          propertyName = propData.propertyName || propData.name || propData.title || "Facility Name Unavailable";
          // Address is stored as an object (street, barangay, ...); older records may use a string
          const addr = propData.address;
          propertyAddress =
            typeof addr === "string"
              ? addr
              : [addr?.street, addr?.barangay, addr?.cityMunicipality, addr?.province].filter(Boolean).join(", ") || propData.fullAddress || "";
          propExtras = {
            coverPhotoUrl: getPropertyCoverPhotoUrl(propData) || propData.coverPhotoUrl || "",
            // New records: curfew { enabled, startTime }. Older wizard records: curfewEnabled / curfewTime.
            curfewTime: propData.curfew?.enabled ? propData.curfew.startTime || "" : propData.curfewEnabled ? propData.curfewTime || "" : "",
            rules: Array.isArray(propData.rules) ? propData.rules.filter(Boolean) : typeof propData.rules === "string" ? propData.rules.split(/\r?\n/).map((r) => r.trim()).filter(Boolean) : [],
            ruleFiles: Array.isArray(propData.ruleFiles) ? propData.ruleFiles.filter((f) => f?.url) : [],
            amenities: Array.isArray(propData.amenities) ? propData.amenities.filter(Boolean) : [],
            emergencyPhone: propData.emergencyPhone || "",
            paymentMethods: readPayMethods(propData.paymentMethods),
            paymentNote: String(propData.paymentNote || ""),
          };
          // The tenant's room (roomId is the room's name/id, e.g. "A2")
          const rooms = Array.isArray(propData.rooms) ? propData.rooms : [];
          assignedRoom = rooms.find((room) => room.roomName === data.roomId || room.id === data.roomId) || null;
        }

        setTenantInfo({
          name: data.name || data.fullName || "Tenant",
          propertyName,
          propertyAddress,
          coverPhotoUrl: "",
          curfewTime: "",
          rules: [],
          ruleFiles: [],
          amenities: [],
          emergencyPhone: "",
          paymentMethods: [],
          paymentNote: "",
          ...propExtras,
          roomNumber: assignedRoom?.roomName || data.roomId || data.roomNumber || "N/A",
          bedId: data.bedId || "N/A",
          // Preserve the tenant's agreed rent; use the room rate only for legacy records without one.
          monthlyRent: Number(data.monthlyRent ?? data.rentAmount ?? data.roomMonthlyRate ?? data.monthlyRate ?? data.rent ?? assignedRoom?.monthlyRatePerBed ?? 0) || 0,
          status: data.status || "Active",
          leaseStartDate: data.leaseStartDate || data.leaseStart || data.startDate || data.moveInDate || "Not specified",
          leaseEndDate: data.leaseEndDate || data.leaseEnd || data.endDate || data.moveOutDate || "",
          leaseMonths: LEASE_MONTHS[data.leaseDuration] || null,
          // From the dates when there are both (a saved label can be out of date), else the label
          leaseDuration:
            leaseLengthText(data.leaseStartDate || data.leaseStart || data.startDate || data.moveInDate, data.leaseEndDate || data.leaseEnd || data.endDate || data.moveOutDate) ||
            formatLeaseDuration(data.leaseDuration),
          contact: data.phone || data.contactNumber || data.contact || "None provided",
          ownerUid: data.ownerUid || data.landlordUid || data.invitedBy || "",
          propertyId,
          rentDueDay: Number(data.rentDueDay || data.dueDay || 5),
        });
        setLoadError("");
        setLoading(false);
      };

      const listen = (path, key) =>
        onSnapshot(
          doc(db, path, user.uid),
          (snap) => {
            latest[key] = snap.exists() ? snap.data() : null;
            build();
          },
          (err) => {
            console.error(`Error fetching tenant ${key} record:`, err);
            latest[key] = null;
            build();
          }
        );
      unsubs.push(listen("users", "user"), listen("tenants", "tenant"), () => unsubProp && unsubProp());
      setOutbox(readOutbox(user.uid));
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubs.forEach((u) => u());
      unsubs = [];

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      loadProfile(user);

      const onListenError = (label) => (error) => {
        console.error(`Error listening to tenant ${label}:`, error);
        if (!cancelled) setListenError(true);
      };

      unsubs.push(
        onSnapshot(
          query(collection(db, "maintenance_tickets"), where("tenantUid", "==", user.uid)),
          (snapshot) => setTickets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
          onListenError("tickets")
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, "payments"), where("tenantId", "==", user.uid)),
          (snapshot) => {
            const docs = snapshot.docs.map((d) => {
              const raw = d.data();
              // keep the receipt fields even if normalizePayment doesn't know about them
              return { ...normalizePayment({ id: d.id, ...raw }), receiptNo: raw.receiptNo || "", receiptIssuer: raw.receiptIssuer || null };
            });
            docs.sort((a, b) => getTimestampMillis(b.paymentDate || b.createdAt) - getTimestampMillis(a.paymentDate || a.createdAt) || getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
            setPayments(docs);
          },
          onListenError("payments")
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, "charges"), where("tenantId", "==", user.uid)),
          (snapshot) => setCharges(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isActiveCharge)),
          // Fees are extra: not being able to read them must not break the page
          (error) => console.warn("Fees unavailable:", error?.code || error)
        )
      );

      // Announcements arrive as notifications: the owner's broadcasts (announcementId) and caretaker notices (kind: "notice")
      unsubs.push(
        onSnapshot(
          query(collection(db, "notifications"), where("userId", "==", user.uid)),
          (snapshot) => {
            const docs = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((n) => (n.announcementId || n.kind === "notice") && n.category !== "maintenance" && !/^Repair update/i.test(n.title || ""))
              .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
            setAnnouncements(docs);
          },
          onListenError("announcements")
        )
      );

      // The tenant's own curfew record (the caretaker writes one per tenant per night)
      unsubs.push(
        onSnapshot(
          query(collection(db, "curfew_records"), where("tenantId", "==", user.uid)),
          (snapshot) => {
            const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
            setCurfewRecords(docs);
          },
          (error) => console.warn("Curfew record unavailable:", error?.code || error)
        )
      );
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      unsubs.forEach((u) => u());
    };
  }, [navigate, reloadKey]);

  // ---- saved-offline queue
  const flushOutbox = async () => {
    const user = auth.currentUser;
    if (!user || flushing.current) return;
    const items = readOutbox(user.uid);
    // Nothing saved: the list on screen was already read from storage when the page loaded
    if (items.length === 0) return;
    flushing.current = true;
    let sent = 0;
    try {
      let remaining = items;
      for (const item of items) {
        try {
          const sentRef = await addDoc(collection(db, item.kind === "payment" ? "payments" : "maintenance_tickets"), { ...item.record, createdAt: serverTimestamp() });
          if (item.kind === "payment") notifyPaymentSubmitted({ id: sentRef.id, ...item.record }, "tenant");
          else notifyMaintenanceSubmitted({ id: sentRef.id, ...item.record }, "tenant");
          remaining = remaining.filter((x) => x.id !== item.id);
          writeOutbox(user.uid, remaining);
          sent += 1;
        } catch (err) {
          console.warn("Saved item not sent yet:", err?.code || err);
          break;
        }
      }
      setOutbox(readOutbox(user.uid));
      if (sent > 0) notify(sent === 1 ? "Your saved item was sent." : `${sent} saved items were sent.`);
    } finally {
      flushing.current = false;
    }
  };
  const queueOffline = (kind, record) => {
    const user = auth.currentUser;
    if (!user) return;
    const next = [...readOutbox(user.uid), { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, kind, record }];
    writeOutbox(user.uid, next);
    setOutbox(next);
  };
  useEffect(() => {
    if (loading || !online) return;
    flushOutbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, loading]);

  // ---- announcements: mark as read
  const markRead = (list) => {
    list.filter((n) => n.isRead === false).forEach((n) => updateDoc(doc(db, "notifications", n.id), { isRead: true }).catch((err) => console.warn("Couldn't mark as read:", err?.code || err)));
  };

  // ---- repair requests: add an update, edit, cancel
  const openTicketDlg = (mode, t) => setTicketDlg({ mode, ticket: t, title: t.title || "", description: t.description || "", text: "", photo: null, photoError: "", busy: false, error: "" });
  const closeTicketDlg = () => {
    if (!ticketDlg.busy) setTicketDlg((d) => ({ ...d, mode: "" }));
  };
  const submitTicketDlg = async () => {
    const user = auth.currentUser;
    const t = ticketDlg.ticket;
    if (!user || !t || ticketDlg.busy) return;
    if (!online) {
      setTicketDlg((d) => ({ ...d, error: "You're offline. Connect to the internet and try again." }));
      return;
    }
    const live = tickets.find((x) => x.id === t.id);
    if (!live) {
      setTicketDlg((d) => ({ ...d, mode: "" }));
      return;
    }
    if (ticketDlg.mode !== "update" && (live.status || "Pending") !== "Pending") {
      setTicketDlg((d) => ({ ...d, error: "Work has already started on this request, so it can't be changed. Add an update instead." }));
      return;
    }
    if (ticketDlg.mode === "edit" && !ticketDlg.title.trim()) {
      setTicketDlg((d) => ({ ...d, error: "Give the request a title." }));
      return;
    }
    if (ticketDlg.mode === "update" && !ticketDlg.text.trim() && !ticketDlg.photo) {
      setTicketDlg((d) => ({ ...d, error: "Write a message or add a photo." }));
      return;
    }
    setTicketDlg((d) => ({ ...d, busy: true, error: "" }));
    try {
      const ref = doc(db, "maintenance_tickets", t.id);
      if (ticketDlg.mode === "cancel") {
        await updateDoc(ref, { status: "Cancelled", cancelledAt: serverTimestamp(), cancelledBy: "tenant", updatedAt: serverTimestamp() });
        notifyMaintenanceCancelled(t, "tenant");
        notify("Request cancelled.");
      } else if (ticketDlg.mode === "edit") {
        await updateDoc(ref, { title: ticketDlg.title.trim(), description: ticketDlg.description.trim(), updatedAt: serverTimestamp() });
        notify("Request updated.");
      } else {
        let photoUrl = "";
        if (ticketDlg.photo) {
          try {
            photoUrl = await uploadToCloudinary(ticketDlg.photo);
          } catch (uploadErr) {
            console.error("Photo upload failed:", uploadErr);
            setTicketDlg((d) => ({ ...d, busy: false, photoError: "The photo couldn't be uploaded. Try again, or remove it to send without one." }));
            return;
          }
        }
        const entry = { text: ticketDlg.text.trim(), ...(photoUrl ? { photoUrl } : {}), at: new Date().toISOString(), by: "tenant" };
        await updateDoc(ref, { followUps: arrayUnion(entry), updatedAt: serverTimestamp() });
        notifyMaintenanceFollowUp(t, "tenant");
        if (t.ownerUid) {
          addDoc(collection(db, "notifications"), {
            userId: t.ownerUid,
            kind: "maintenance_update",
            category: "maintenance",
            type: "info",
            title: `Update on "${t.title || "a repair request"}"`,
            message: `${tenantInfo.name} (Room ${tenantInfo.roomNumber || "N/A"}) added an update.`,
            isRead: false,
            createdBy: user.uid,
            createdByRole: "tenant",
            createdAt: new Date().toISOString(),
          }).catch((err) => console.warn("Owner notice failed:", err?.code || err));
        }
        notify("Update sent.");
      }
      setTicketDlg((d) => ({ ...d, mode: "", busy: false }));
    } catch (err) {
      console.error("Couldn't change the request:", err);
      setTicketDlg((d) => ({ ...d, busy: false, error: "Couldn't do that right now. Please try again." }));
    }
  };

  // ---- maintenance submit
  const openRepair = () => {
    setRepairTouched(false);
    setRepairPhoto(null);
    setRepairPhotoError("");
    setOpenRepairModal(true);
  };

  const handleRequestSubmit = async () => {
    const user = auth.currentUser;
    setRepairTouched(true);
    if (!user || !repairForm.title.trim() || repairSubmitting) return;
    if (!online) {
      // Keep it on this phone and send it when the connection is back (photos can't be kept offline)
      queueOffline("repair", {
        tenantUid: user.uid,
        tenantName: tenantInfo.name,
        ownerUid: tenantInfo.ownerUid,
        propertyId: tenantInfo.propertyId,
        propertyName: tenantInfo.propertyName,
        roomNumber: tenantInfo.roomNumber,
        title: repairForm.title.trim(),
        description: repairForm.description.trim(),
        category: repairForm.category,
        status: "Pending",
      });
      setOpenRepairModal(false);
      setRepairForm({ title: "", description: "", category: CATEGORIES.SAFETY });
      setRepairPhoto(null);
      notify(repairPhoto ? "Saved on your phone. It sends when you're back online. Add the photo as an update afterwards." : "Saved on your phone. It sends when you're back online.", "info");
      return;
    }

    try {
      setRepairSubmitting(true);

      let photoUrl = "";
      if (repairPhoto) {
        try {
          photoUrl = await uploadToCloudinary(repairPhoto);
        } catch (uploadErr) {
          console.error("Photo upload failed:", uploadErr);
          setRepairPhotoError("The photo couldn't be uploaded. Try again, or remove it to send without a photo.");
          return;
        }
      }

      const ticketRef = await addDoc(collection(db, "maintenance_tickets"), {
        tenantUid: user.uid,
        tenantName: tenantInfo.name,
        ownerUid: tenantInfo.ownerUid,
        propertyId: tenantInfo.propertyId,
        propertyName: tenantInfo.propertyName,
        roomNumber: tenantInfo.roomNumber,
        title: repairForm.title.trim(),
        description: repairForm.description.trim(),
        category: repairForm.category,
        ...(photoUrl ? { photoUrl } : {}),
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      notifyMaintenanceSubmitted(
        {
          id: ticketRef.id,
          tenantUid: user.uid,
          tenantName: tenantInfo.name,
          ownerUid: tenantInfo.ownerUid,
          propertyId: tenantInfo.propertyId,
          roomNumber: tenantInfo.roomNumber,
          title: repairForm.title.trim(),
          category: repairForm.category,
        },
        "tenant",
      );
      setOpenRepairModal(false);
      setRepairForm({ title: "", description: "", category: CATEGORIES.SAFETY });
      setRepairPhoto(null);
      notify("Request sent. Your landlord has been notified.");
    } catch (err) {
      console.error("Error submitting repair request:", err);
      notify("Couldn't send the request. Please try again.", "error");
    } finally {
      setRepairSubmitting(false);
    }
  };

  // ---- payment flow
  const openPayRentModal = (months) => {
    const first = openMonths[0]?.label || currentPeriod;
    setPayMonths(Array.isArray(months) && months.length ? months : [first]);
    setPaymentError("");
    setPaymentTouched({});
    setSubmittedPayment(null);
    setProofFile(null);
    setProofError("");
    setPayStep(0);
    setSelectedPaymentMethod(tenantInfo.paymentMethods?.[0]?.key || "");
    setPaymentForm({
      amount: String(billFor(first).balance || tenantInfo.monthlyRent || ""),
      referenceNumber: "",
      paymentDate: getTodayInputValue(),
      remarks: "",
    });
    setOpenPaymentModal(true);
  };

  // Months in calendar order; several months = a fixed amount: what each month still owes (rent + fees)
  const sortedPayMonths = openMonths.map((m) => m.label).filter((l) => payMonths.includes(l));
  const multiMonth = sortedPayMonths.length > 1;
  const monthlyRentNum = Number(tenantInfo.monthlyRent) || 0;
  const monthDue = (label) => billFor(label).balance || monthlyRentNum;
  const totalDue = Math.round((sortedPayMonths.length ? sortedPayMonths : [currentPeriod]).reduce((s, l) => s + monthDue(l), 0) * 100) / 100;
  const payBill = billFor(sortedPayMonths[0] || currentPeriod);
  const togglePayMonth = (label) => {
    const next = payMonths.includes(label) ? payMonths.filter((l) => l !== label) : [...payMonths, label];
    const list = next.length ? next : payMonths; // always keep one month
    setPayMonths(list);
    // Paying for one month keeps the amount editable; several months fix it to what those months owe
    const sum = Math.round(list.reduce((s, l) => s + monthDue(l), 0) * 100) / 100;
    setPaymentForm((f) => ({ ...f, amount: String(sum || f.amount) }));
  };
  const amountNum = multiMonth ? totalDue : Number(paymentForm.amount);
  const paymentErrors = {
    amount: !amountNum || amountNum <= 0 ? "Enter a valid amount." : "",
    referenceNumber: !paymentForm.referenceNumber.trim() ? "Enter the reference number from your payment." : "",
    paymentDate: !paymentForm.paymentDate ? "Choose the payment date." : paymentForm.paymentDate > getTodayInputValue() ? "The date can't be in the future." : "",
  };
  const showPayErr = (k) => (paymentTouched[k] ? paymentErrors[k] : "");

  const handlePaymentSubmit = async () => {
    const user = auth.currentUser;
    if (!user || paymentSubmitting) return;

    setPaymentTouched({ amount: true, referenceNumber: true, paymentDate: true });
    if (Object.values(paymentErrors).some(Boolean)) return;

    if (!tenantInfo.ownerUid) {
      setPaymentError("Your account is not linked to an owner yet. Please contact the property owner.");
      return;
    }
    if (multiMonth && !(totalDue > 0)) {
      setPaymentError("Your monthly rent isn't set yet, so you can only pay one month at a time. Ask your landlord to set it.");
      return;
    }

    // One record per month, so the owner verifies, receipts and tracks each month on its own.
    // Months paid together share the reference number and a group id.
    const months = sortedPayMonths.length ? sortedPayMonths : [currentPeriod];
    const groupId = months.length > 1 ? `adv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : null;
    const baseRemarks = paymentForm.remarks.trim();
    const buildRecord = (periodMonth, extra = {}) => ({
      tenantId: user.uid,
      tenantName: tenantInfo.name,
      ownerUid: tenantInfo.ownerUid,
      propertyId: tenantInfo.propertyId,
      propertyName: tenantInfo.propertyName,
      roomNumber: tenantInfo.roomNumber,
      amount: months.length > 1 ? monthDue(periodMonth) : amountNum,
      paymentMethod: payMethodKey,
      periodMonth,
      // What the month was billed at (rent + fees), for the owner's review and the receipt
      bill: billSnapshot(monthlyRentNum, charges.filter((c) => chargeAppliesTo(c, periodMonth))),
      // IMPORTANT: a tenant can never mark a payment as Paid.
      status: "Pending",
      verificationStatus: "Pending",
      referenceNumber: paymentForm.referenceNumber.trim(),
      paymentDate: paymentForm.paymentDate,
      remarks: months.length > 1 ? [`One of ${months.length} months paid together (${periodsText(months)}).`, baseRemarks].filter(Boolean).join(" ") : baseRemarks,
      ...(groupId ? { advanceGroupId: groupId, advanceMonths: months } : {}),
      // Every month offered is this month or later, so anything else is paid ahead
      ...(periodMonth !== currentPeriod ? { paidInAdvance: true } : {}),
      ...extra,
    });
    const summaryOf = (records) => ({
      ...records[0],
      amount: records.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      periodMonth: periodsText(months),
      months,
    });

    if (!online) {
      const queued = months.map((m) => buildRecord(m));
      queued.forEach((r) => queueOffline("payment", r));
      setSubmittedPayment({ ...summaryOf(queued), queued: true });
      setPayStep(2);
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentError("");

      // Optional proof of payment (screenshot of the receipt)
      let proofUrl = "";
      if (proofFile) {
        try {
          proofUrl = await uploadToCloudinary(proofFile);
        } catch (uploadErr) {
          console.error("Proof upload failed:", uploadErr);
          setPaymentError("The screenshot couldn't be uploaded. Try again, or remove it to submit without it.");
          return;
        }
      }

      const records = months.map((m) => buildRecord(m, proofUrl ? { proofUrl } : {}));
      // All months are saved together, or none are
      const batch = writeBatch(db);
      const refs = records.map((record) => {
        const ref = doc(collection(db, "payments"));
        batch.set(ref, { ...record, createdAt: serverTimestamp() });
        return ref;
      });
      await batch.commit();
      // One notice for the owner, not one per month
      notifyPaymentSubmitted({ id: refs[0].id, ...summaryOf(records) }, "tenant");

      setSubmittedPayment(summaryOf(records));
      setPayStep(2);
    } catch (err) {
      console.error("Error submitting payment:", err);
      setPaymentError("Unable to submit the payment right now. Please try again.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const goNextStep = () => setPayStep(1);

  // The rent receipt as a picture on the phone (Photos / Downloads), see utils/receiptImage.js
  const [savingReceipt, setSavingReceipt] = useState(false);
  const saveReceipt = async (p) => {
    if (savingReceipt) return;
    setSavingReceipt(true);
    try {
      const result = await saveReceiptImage({
        receiptNo: p.receiptNo,
        issuer: p.receiptIssuer,
        tenant: p.tenantName || tenantInfo.name,
        property: p.propertyName || tenantInfo.propertyName,
        room: p.roomNumber || tenantInfo.roomNumber,
        period: p.periodMonth,
        dateText: fmtDate(p.paymentDate) || "—",
        method: p.paymentMethod,
        reference: p.referenceNumber,
        amountText: peso(p.amount),
        remarks: p.remarks,
        bill: p.bill,
        partial: String(p.status || "").toLowerCase() === "partial",
      });
      if (result === "downloaded") notify("Receipt saved. Find it in your Downloads or Photos.");
      else if (result === "shared") notify("Receipt ready. Choose Save Image to keep it in your Photos.");
    } catch (err) {
      console.error("Couldn't save the receipt:", err);
      notify("Couldn't save the receipt. Please try again.", "error");
    } finally {
      setSavingReceipt(false);
    }
  };

  const copyText = async (text, label = "Copied.") => {
    try {
      await navigator.clipboard.writeText(text);
      notify(label);
    } catch {
      notify("Couldn't copy. Select the text and copy it manually.", "warning");
    }
  };

  const sharePayment = async (p) => {
    const text = `Rent payment · ${p.periodMonth || ""}\nAmount: ${peso(p.amount)}\nMethod: ${p.paymentMethod || "—"}\nReference: ${p.referenceNumber || "—"}\nStatus: ${p.status || "Pending"}`;
    try {
      if (navigator.share) await navigator.share({ title: t("Payment details"), text });
      else await copyText(text, "Payment details copied.");
    } catch {
      /* the person closed the share sheet */
    }
  };

  // ---- derived
  const rankedTickets = useMemo(() => rankMaintenanceRequests(tickets), [tickets]);
  const activeTickets = rankedTickets.filter((t) => !["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const resolvedTickets = rankedTickets.filter((t) => ["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const payMethods = tenantInfo.paymentMethods || [];
  const activePayMethod = payMethods.find((m) => m.key === selectedPaymentMethod) || payMethods[0] || null;
  const payMethodKey = activePayMethod?.key || selectedPaymentMethod || "GCash";

  const statusTone = /suspend|inactive|terminated/i.test(tenantInfo.status) ? "error" : /pending/i.test(tenantInfo.status) ? "warning" : "success";

  // ---- curfew + house rules
  const curfewMin = parseClock(tenantInfo.curfewTime);
  const clock = useClock(curfewMin !== null);
  const recentCurfew = curfewRecords.filter((r) => Date.now() - new Date(`${r.date}T12:00:00`).getTime() <= 30 * 86400000);
  const hasHouseRules = Boolean(tenantInfo.curfewTime) || tenantInfo.rules.length > 0 || tenantInfo.ruleFiles.length > 0;
  const rulesSig = JSON.stringify([tenantInfo.curfewTime, tenantInfo.rules]);
  const rulesKey = `kk_rules_ack_${tenantInfo.propertyId}`;
  const storedRulesAck = (() => {
    try {
      return window.localStorage.getItem(rulesKey);
    } catch {
      return null;
    }
  })();
  const rulesAcked = !tenantInfo.propertyId || !hasHouseRules || storedRulesAck === rulesSig || rulesAckedSig === `${rulesKey}|${rulesSig}`;
  const ackRules = () => {
    try {
      window.localStorage.setItem(rulesKey, rulesSig);
    } catch {
      /* storage unavailable: the banner just returns next visit */
    }
    setRulesAckedSig(`${rulesKey}|${rulesSig}`);
  };
  const hasCover = Boolean(tenantInfo.coverPhotoUrl) && !coverFailed;

  const paidThisYear = useMemo(() => {
    const y = String(new Date().getFullYear());
    return payments.filter((p) => p.status === "Paid" && String(p.periodMonth || "").includes(y)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [payments]);

  const unreadCount = announcements.filter((n) => n.isRead === false).length;
  const visibleAnnouncements = announcementFilter === "unread" ? announcements.filter((n) => n.isRead === false) : announcements;
  const shownTickets = ticketFilter === "all" ? activeTickets : activeTickets.filter((t) => (t.status || "Pending") === ticketFilter);

  const paymentKind = (p) => {
    const k = String(p.status || "pending").toLowerCase();
    return k === "paid" ? "paid" : k === "rejected" ? "rejected" : "pending";
  };
  const paymentCounts = useMemo(
    () => ({
      all: payments.length,
      paid: payments.filter((p) => paymentKind(p) === "paid").length,
      pending: payments.filter((p) => paymentKind(p) === "pending").length,
      rejected: payments.filter((p) => paymentKind(p) === "rejected").length,
    }),
    [payments]
  );
  const filteredPayments = useMemo(() => (paymentFilter === "all" ? payments : payments.filter((p) => paymentKind(p) === paymentFilter)), [payments, paymentFilter]);

  const paymentsByYear = useMemo(() => {
    const groups = {};
    filteredPayments.forEach((p) => {
      const ms = getTimestampMillis(p.paymentDate || p.createdAt);
      const y = ms ? new Date(ms).getFullYear() : "Earlier";
      (groups[y] = groups[y] || []).push(p);
    });
    return Object.entries(groups).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  }, [filteredPayments]);

  /* ---------------------------------------------------------------------
     Loading
  --------------------------------------------------------------------- */
  if (loadError) {
    return (
      <Paper elevation={0} sx={cardSx}>
        <EmptyState
          icon={<ErrorOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
          title={t("We couldn't open your dashboard")}
          body={loadError}
          action={
            <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={retryLoad} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
              {t("Try again")}
            </Button>
          }
        />
      </Paper>
    );
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: 4, mb: 3 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} variant="rounded" height={112} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  /* ---------------------------------------------------------------------
     Tabs
  --------------------------------------------------------------------- */
  // Things the tenant should look at first
  const attention = [];
  if (statusTone === "error") {
    attention.push({ key: "account", tone: "error", title: t("Your account is {status}", { status: t(String(tenantInfo.status)).toLowerCase() }), body: t("Please contact your landlord to sort this out.") });
  }
  if (tenantInfo.propertyName === "Not Assigned") {
    attention.push({ key: "unassigned", tone: "warning", title: t("No room assigned yet"), body: t("Your landlord hasn't linked you to a room. Rent and lease details appear once they do.") });
  }
  if (statusKey === "rejected") {
    attention.push({
      key: "rejected",
      tone: "error",
      title: t("Your payment couldn't be verified"),
      body: currentPeriodPayment?.rejectionReason || t("Check the reference number and submit it again."),
      actionLabel: t("Submit again"),
      onAction: openPayRentModal,
    });
  } else if (statusKey === "overdue") {
    attention.push({ key: "overdue", tone: "error", title: t("Your rent is overdue"), body: t("{amount} for {period} · {due}", { amount: peso(dueNow), period: currentPeriod, due: dueText.toLowerCase() }), actionLabel: t("Pay now"), onAction: openPayRentModal });
  } else if (feesOutstanding && canPay) {
    attention.push({
      key: "fees",
      tone: daysToDue < 0 ? "error" : "warning",
      title: t("{amount} in fees still due", { amount: peso(currentBill.balance) }),
      body: t("Added to {period}: {fees}. Your rent itself is paid.", { period: currentPeriod, fees: currentBill.fees.map((c) => c.label).join(", ") }),
      actionLabel: t("Pay fees"),
      onAction: openPayRentModal,
    });
  } else if (canPay && daysToDue >= 0 && daysToDue <= 3) {
    attention.push({ key: "soon", tone: "warning", title: daysToDue === 0 ? t("Rent is due today") : t("Rent is due in {days}", { days: daysToDue === 1 ? t("{n} day", { n: daysToDue }) : t("{n} days", { n: daysToDue }) }), body: t("{amount} for {period}", { amount: peso(dueNow), period: currentPeriod }), actionLabel: t("Pay now"), onAction: openPayRentModal });
  }
  // Lease: tell the tenant a month ahead, and again once it has ended
  if (lease && !lease.open) {
    if (lease.ended) {
      attention.push({
        key: "lease",
        tone: "error",
        icon: CalendarMonthOutlinedIcon,
        title: t("Your lease has ended"),
        body: t("It ended on {date}. Please talk to your landlord about renewing or moving out.", { date: fmtDate(lease.endMs) }),
      });
    } else if (lease.daysLeft <= 30) {
      attention.push({
        key: "lease",
        tone: "warning",
        icon: CalendarMonthOutlinedIcon,
        title: lease.daysLeft === 0 ? t("Your lease ends today") : t("Your lease ends in {days}", { days: lease.daysLeft === 1 ? t("{n} day", { n: lease.daysLeft }) : t("{n} days", { n: lease.daysLeft }) }),
        body: t("Ends on {date}. Talk to your landlord if you'd like to renew.", { date: fmtDate(lease.endMs) }),
      });
    }
  }
  if (curfewMin !== null) {
    const nowMin = clock.getHours() * 60 + clock.getMinutes();
    const until = (curfewMin - nowMin + 1440) % 1440;
    const since = (nowMin - curfewMin + 1440) % 1440;
    if (since < 180) {
      attention.push({ key: "curfew", tone: "info", icon: ScheduleIcon, title: t("Curfew is in effect"), body: t("Curfew started at {time}. Please check the house rules if you're out.", { time: tenantInfo.curfewTime }) });
    } else if (until <= 120) {
      const label = until >= 60 ? `${Math.floor(until / 60)} h ${until % 60} min` : `${until} min`;
      attention.push({ key: "curfew", tone: "warning", icon: ScheduleIcon, title: t("Curfew in {time}", { time: label }), body: t("Be back at {place} by {time}.", { place: tenantInfo.propertyName, time: tenantInfo.curfewTime }) });
    }
  }
  if (!rulesAcked && hasHouseRules) {
    attention.push({
      key: "rules",
      tone: "info",
      icon: PolicyOutlinedIcon,
      title: t("Please read your house rules"),
      body: tenantInfo.curfewTime ? t("Includes the curfew ({time}) set for {place}.", { time: tenantInfo.curfewTime, place: tenantInfo.propertyName }) : t("Set by the owner of {place}.", { place: tenantInfo.propertyName }),
      actionLabel: t("Read rules"),
      onAction: () => {
        ackRules();
        goTab("profile");
      },
      secondaryLabel: t("Got it"),
      onSecondary: ackRules,
    });
  }

  const heroBtnSx = {
    fontWeight: 700,
    borderRadius: 2.5,
    color: "#fff",
    borderColor: "rgba(255,255,255,0.35)",
    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
  };

  const overview = (
    <TenantOverviewTab
      activeTickets={activeTickets}
      aheadMonths={aheadMonths}
      announcementFilter={announcementFilter}
      announcements={announcements}
      announcementsShown={announcementsShown}
      attention={attention}
      attentionOpen={attentionOpen}
      canPay={canPay}
      canPayAhead={canPayAhead}
      currentBill={currentBill}
      currentPeriod={currentPeriod}
      dueDate={dueDate}
      dueText={dueText}
      feesOutstanding={feesOutstanding}
      goTab={goTab}
      hasCover={hasCover}
      heroBtnSx={heroBtnSx}
      isPaid={isPaid}
      markRead={markRead}
      openPayRentModal={openPayRentModal}
      openRepair={openRepair}
      rankedTickets={rankedTickets}
      rentStatus={rentStatus}
      setAnnouncementFilter={setAnnouncementFilter}
      setAnnouncementsShown={setAnnouncementsShown}
      setAttentionOpen={setAttentionOpen}
      setCoverFailed={setCoverFailed}
      statusTone={statusTone}
      tenantInfo={tenantInfo}
      unreadCount={unreadCount}
      visibleAnnouncements={visibleAnnouncements}
    />
  );

  const currentStep = !currentPeriodPayment ? -1 : isPaid ? 2 : statusKey === "rejected" ? 2 : 1;

  const paymentsTab = (
    <TenantPaymentsTab
      canPay={canPay}
      canPayAhead={canPayAhead}
      currentBill={currentBill}
      currentPeriod={currentPeriod}
      currentPeriodPayment={currentPeriodPayment}
      currentStep={currentStep}
      daysToDue={daysToDue}
      dueDateLabel={dueDateLabel}
      dueNow={dueNow}
      dueText={dueText}
      filteredPayments={filteredPayments}
      isAwaitingVerification={isAwaitingVerification}
      isPaid={isPaid}
      isPhone={isPhone}
      lease={lease}
      openMonths={openMonths}
      openPayRentModal={openPayRentModal}
      paidThisYear={paidThisYear}
      payableMonths={payableMonths}
      paymentCounts={paymentCounts}
      paymentFilter={paymentFilter}
      payments={payments}
      paymentsByYear={paymentsByYear}
      rentMissing={rentMissing}
      rentStatus={rentStatus}
      setPaymentFilter={setPaymentFilter}
      setReceipt={setReceipt}
      statusKey={statusKey}
    />
  );

  const profileTab = (
    <TenantProfileTab
      ackRules={ackRules}
      hasCover={hasCover}
      hasHouseRules={hasHouseRules}
      lease={lease}
      previewFile={previewFile}
      recentCurfew={recentCurfew}
      rulesAcked={rulesAcked}
      rulesOpen={rulesOpen}
      setPreviewFile={setPreviewFile}
      setRulesOpen={setRulesOpen}
      statusTone={statusTone}
      tenantInfo={tenantInfo}
    />
  );

  const maintenanceTab = (
    <TenantMaintenanceTab
      activeTickets={activeTickets}
      archiveOpen={archiveOpen}
      archiveShown={archiveShown}
      isPhone={isPhone}
      openRepair={openRepair}
      openTicketDlg={openTicketDlg}
      rankedTickets={rankedTickets}
      resolvedTickets={resolvedTickets}
      setArchiveOpen={setArchiveOpen}
      setArchiveShown={setArchiveShown}
      setTicketFilter={setTicketFilter}
      setTicketsShown={setTicketsShown}
      shownTickets={shownTickets}
      ticketFilter={ticketFilter}
      ticketsShown={ticketsShown}
    />
  );

  const fabAction =
    isPhone && activeTab === "payments" && (canPay || canPayAhead)
      ? { label: canPay ? t("Pay rent") : t("Pay ahead"), icon: <PaymentIcon sx={{ mr: 0.75 }} />, onClick: () => openPayRentModal() }
      : isPhone && activeTab === "maintenance"
        ? { label: t("New request"), icon: <AddIcon sx={{ mr: 0.75 }} />, onClick: openRepair }
        : null;

  const closePayment = () => {
    if (paymentSubmitting) return;
    setOpenPaymentModal(false);
  };

  return (
    <Box>
      {AnimationStyles}

      {!online && (
        <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          {t("You're offline. You can still look around. New requests and payments are saved on your phone and sent when you're back online.")}
        </Alert>
      )}
      {outbox.length > 0 && (
        <Alert
          severity="info"
          icon={<CloudOffOutlinedIcon />}
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            online ? (
              <Button color="inherit" size="small" onClick={flushOutbox} sx={{ fontWeight: 700 }}>
                {t("Send now")}
              </Button>
            ) : undefined
          }
        >
          {outbox.length === 1 ? t("1 item is waiting to be sent.") : `${outbox.length} items are waiting to be sent.`} {online ? "" : t("It goes out automatically when you're back online.")}
        </Alert>
      )}
      {online && listenError && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={retryLoad} sx={{ fontWeight: 700 }}>
              {t("Retry")}
            </Button>
          }
        >
          {t("Some of your information couldn't be loaded.")}
        </Alert>
      )}

      <TabErrorBoundary resetKey={activeTab}>
        {activeTab === "overview" && overview}
        {activeTab === "payments" && paymentsTab}
        {activeTab === "profile" && profileTab}
        {activeTab === "maintenance" && maintenanceTab}
      </TabErrorBoundary>

      {/* keeps the last card clear of the floating button */}
      {fabAction && <Box sx={{ height: 72 }} />}

      {fabAction && !openPaymentModal && !openRepairModal && (
        <Fab
          color="primary"
          variant="extended"
          onClick={fabAction.onClick}
          sx={{ position: "fixed", right: 16, bottom: `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom))`, fontWeight: 700, textTransform: "none" }}
        >
          {fabAction.icon} {fabAction.label}
        </Fab>
      )}

      {/* ===================== PAY RENT (3 steps) ===================== */}
      <Dialog
        open={openPaymentModal}
        onClose={(event, reason) => {
          // Don't throw away a half-filled form with a stray tap outside
          if (reason === "backdropClick" && payStep === 1) return;
          closePayment();
        }}
        fullScreen={isPhone}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "background.default" } }}
      >
        <DialogTitle sx={{ pb: 1.25 }}>
          <Box sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }}>
              {payStep === 2 ? t("Payment submitted") : `Pay rent · ${periodsText(sortedPayMonths.length ? sortedPayMonths : [currentPeriod])}`}
            </Typography>
            <IconButton edge="end" aria-label={t("Close")} onClick={closePayment} disabled={paymentSubmitting}>
              <CloseIcon />
            </IconButton>
          </Box>
          {payStep < 2 && (
            <Box sx={{ mt: 1.25 }}>
              <LinearProgress variant="determinate" value={payStep === 0 ? 50 : 100} sx={{ height: 5, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mt: 0.5 }}>
                {t("Step")}{" "}{payStep + 1}{" "}{t("of 2 ·")}{" "}{payStep === 0 ? t("Send your payment") : t("Confirm the details")}
              </Typography>
            </Box>
          )}
        </DialogTitle>

        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
          {/* STEP 0: pay */}
          {payStep === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
              {/* Which months this payment covers (pay ahead by picking more) */}
              {payableMonths.length > 1 && (
                <Box>
                  <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 0.75 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {t("Paying for")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("Tap more months to pay ahead")}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.75 }}>
                    {payableMonths.map((m) => {
                      const selectable = m.status === "open" || m.status === "partial";
                      const on = payMonths.includes(m.label);
                      return (
                        <Box
                          key={m.label}
                          component="button"
                          type="button"
                          disabled={!selectable || (rentMissing && !on && payMonths.length > 0)}
                          onClick={() => togglePayMonth(m.label)}
                          aria-pressed={on}
                          sx={{
                            minWidth: 0,
                            p: 1,
                            borderRadius: 2,
                            font: "inherit",
                            textAlign: "center",
                            cursor: selectable ? "pointer" : "default",
                            border: "1.5px solid",
                            borderColor: on ? "primary.main" : "divider",
                            bgcolor: (t) => (on ? alpha(t.palette.primary.main, 0.08) : "transparent"),
                            color: "text.primary",
                            opacity: selectable ? 1 : 0.6,
                            "&:disabled": { cursor: "default" },
                          }}
                        >
                          <Box sx={{ ...row, justifyContent: "center", gap: 0.5, fontWeight: 800, fontSize: 14 }}>
                            {on && <CheckIcon sx={{ fontSize: 15, color: "primary.main" }} />}
                            {m.short}
                          </Box>
                          <Box sx={{ fontSize: 11.5, color: m.status === "paid" ? "success.dark" : m.status === "pending" ? "warning.dark" : "text.secondary", fontWeight: 600 }}>
                            {m.status === "paid" ? t("Paid") : m.status === "pending" ? t("Sent") : m.status === "partial" ? t("Part paid") : m.current ? t("This month") : t("Ahead")}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  {rentMissing && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      {t("Paying several months at once needs your monthly rent set. Ask your landlord.")}
                    </Typography>
                  )}
                </Box>
              )}

              <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(255, 69, 0, 0.08)" }}>
                <Typography variant="body2" color="text.secondary">
                  {t("Amount to send")}
                </Typography>
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "1.9rem", color: "primary.main", lineHeight: 1.2 }}>
                  {peso(multiMonth ? totalDue : payBill.balance || monthlyRentNum)}
                </Typography>
                {multiMonth && (
                  <Typography variant="caption" color="text.secondary">
                    {sortedPayMonths.length}{" "}{t("months · send it as one payment")}
                  </Typography>
                )}
                {!multiMonth && payBill.fees.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <BillBreakdown bill={payBill} />
                  </Box>
                )}
              </Box>

              {tenantInfo.paymentNote.trim() && (
                <Alert severity="info" icon={false} sx={{ borderRadius: 2, whiteSpace: "pre-line" }}>
                  {tenantInfo.paymentNote.trim()}
                </Alert>
              )}

              {payMethods.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {t("Your landlord hasn't added online payment details yet. Please ask them how to pay. They can record a cash payment for you.")}
                </Alert>
              ) : (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {t("Payment method")}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.75 }}>
                      {payMethods.map((m) => (
                        <Chip
                          key={m.key}
                          label={m.label}
                          clickable
                          onClick={() => setSelectedPaymentMethod(m.key)}
                          color={activePayMethod?.key === m.key ? "primary" : "default"}
                          variant={activePayMethod?.key === m.key ? "filled" : "outlined"}
                          sx={{ fontWeight: 700, height: 40, borderRadius: 20 }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {activePayMethod && (
                    <Box sx={{ textAlign: "center", p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper" }}>
                      <Box sx={{ ...row, justifyContent: "center", gap: 1, mb: 1 }}>
                        <QrCode2Icon color="primary" />
                        <Typography sx={{ fontWeight: 800 }}>
                          {activePayMethod.kind === "wallet" ? `Scan with ${activePayMethod.label}` : t("Scan with any bank or e-wallet app")}
                        </Typography>
                      </Box>

                      {activePayMethod.qrUrl && (
                        <>
                          <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
                            <Box
                              component="a"
                              href={activePayMethod.qrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t("Open QR code full size")}
                              sx={{ display: "block", width: "100%", maxWidth: 240 }}
                            >
                              <Box component="img" src={activePayMethod.qrUrl} alt={`${activePayMethod.label} QR code`} sx={{ display: "block", width: "100%", height: "auto", bgcolor: "#fff", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                            </Box>
                          </Box>
                          {isPhone && (
                            <Box sx={{ textAlign: "center" }}>
                              <Button
                                size="small"
                                startIcon={<DownloadOutlinedIcon />}
                                onClick={async () => ((await saveImage(activePayMethod.qrUrl, `${activePayMethod.key}-payment-qr.png`)) ? notify("QR saved to your photos/downloads.") : notify("Couldn't save it here. Tap the QR to open it, then press and hold to save.", "warning"))}
                                sx={{ fontWeight: 700, mb: 0.5, minHeight: 40 }}
                              >
                                {t("Save QR to my phone")}
                              </Button>
                              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.25 }}>
                                {t("Paying from this phone? Save the QR, then in your")}{" "}{activePayMethod.kind === "wallet" ? activePayMethod.label : t("bank or e-wallet")}{" "}{t("app choose")}{" "}<strong>{t("Pay QR → Upload from gallery")}</strong>.
                              </Typography>
                            </Box>
                          )}
                        </>
                      )}

                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {activePayMethod.accountName}
                      </Typography>
                      {activePayMethod.kind === "wallet" && activePayMethod.accountNumber && (
                        <Box sx={{ ...row, justifyContent: "center", gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {prettyMobile(activePayMethod.accountNumber)}
                          </Typography>
                          <IconButton size="small" aria-label={t("Copy number")} onClick={() => copyText(activePayMethod.accountNumber, "Number copied.")}>
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      )}
                      {activePayMethod.kind === "wallet" && !activePayMethod.qrUrl && (
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                          {t("Send to this number in your")}{" "}{activePayMethod.label}{" "}{t("app.")}
                        </Typography>
                      )}
                    </Box>
                  )}
                </>
              )}

              {payMethods.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t("Send the payment first, then tap")}{" "}<strong>{t("I've paid")}</strong>{" "}{t("to enter your reference number.")}
                </Typography>
              )}
            </Box>
          )}

          {/* STEP 1: details */}
          {payStep === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
              {paymentError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {paymentError}
                </Alert>
              )}

              <Box sx={{ ...row, justifyContent: "space-between", p: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.05) }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t("Paid via")}
                </Typography>
                <Pill label={payMethodKey} />
              </Box>

              {multiMonth && (
                <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.06) }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {sortedPayMonths.length}{" "}{t("months:")}{" "}{sortedPayMonths.map(shortPeriod).join(", ")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("Your owner verifies each month. Each one is marked Paid when they do.")}
                  </Typography>
                </Box>
              )}

              <TextField
                label={multiMonth ? t("Total amount sent") : t("Payment amount")}
                type="number"
                fullWidth
                size="small"
                value={multiMonth ? String(totalDue) : paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                onBlur={() => setPaymentTouched((t) => ({ ...t, amount: true }))}
                disabled={multiMonth}
                error={!!showPayErr("amount")}
                helperText={
                  multiMonth
                    ? `What ${sortedPayMonths.length} months still owe, added up. To send a different amount, pay one month at a time.`
                    : showPayErr("amount") || (amountNum > 0 && monthDue(sortedPayMonths[0] || currentPeriod) > 0 && amountNum !== monthDue(sortedPayMonths[0] || currentPeriod) ? `This is different from the ${peso(monthDue(sortedPayMonths[0] || currentPeriod))} due. Your owner will review it.` : "")
                }
                slotProps={{ input: { startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography> }, htmlInput: { min: 0, inputMode: "decimal" } }}
              />

              <TextField
                label={t("Payment reference number")}
                fullWidth
                size="small"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                onBlur={() => setPaymentTouched((t) => ({ ...t, referenceNumber: true }))}
                error={!!showPayErr("referenceNumber")}
                helperText={showPayErr("referenceNumber") || "Found on your payment receipt or confirmation message."}
                placeholder={t("Enter the reference number from your payment")}
              />

              <TextField
                label={t("Payment date")}
                type="date"
                fullWidth
                size="small"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                onBlur={() => setPaymentTouched((t) => ({ ...t, paymentDate: true }))}
                error={!!showPayErr("paymentDate")}
                helperText={showPayErr("paymentDate")}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: getTodayInputValue() } }}
              />

              <TextField
                label={t("Remarks (optional)")}
                multiline
                minRows={2}
                fullWidth
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value.slice(0, 300) })}
                placeholder={t("Add any additional payment details")}
                helperText={`${paymentForm.remarks.length}/300`}
              />

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
                  {t("Proof of payment (optional)")}
                </Typography>
                <PhotoPicker
                  file={proofFile}
                  onChange={setProofFile}
                  onError={setProofError}
                  disabled={paymentSubmitting}
                  label={t("Attach a screenshot of your receipt")}
                  hint={t("Helps your owner verify faster")}
                />
                {proofError && (
                  <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                    {proofError}
                  </Typography>
                )}
              </Box>

              {!online && (
                <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ borderRadius: 2 }}>
                  {t("You're offline. Submitting saves it on your phone, and it's sent automatically once you're back online.")}
                </Alert>
              )}

              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                {t("Your payment will be recorded as")}{" "}<strong>{t("Pending")}</strong>{t(". The owner must verify it before it becomes")}{" "}<strong>{t("Paid")}</strong>.
              </Alert>
            </Box>
          )}

          {/* STEP 2: done */}
          {payStep === 2 && submittedPayment && (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Box sx={{ width: 84, height: 84, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: (t) => alpha(t.palette.success.main, 0.14), animation: "kkPop .45s ease-out both" }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="30" style={{ animation: "kkCheck .5s ease-out .2s both" }} />
                </svg>
              </Box>
              <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "1.4rem" }}>{submittedPayment.queued ? t("Saved on your phone") : t("Payment sent!")}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                {submittedPayment.queued
                  ? t("You're offline. We'll send it automatically once you're back online. A proof screenshot can't be kept offline, so show it to your landlord if asked.")
                  : t("Your owner will verify it soon. We'll notify you once it's marked Paid.")}
              </Typography>
              <Box sx={{ textAlign: "left", p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Facts
                  items={[
                    { label: t("Amount"), value: peso(submittedPayment.amount), color: "success.main" },
                    { label: t("Period"), value: submittedPayment.periodMonth },
                    { label: t("Method"), value: submittedPayment.paymentMethod },
                    { label: t("Reference"), value: submittedPayment.referenceNumber },
                    { label: t("Status"), value: "Pending verification" },
                  ]}
                />
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: { xs: "calc(12px + env(safe-area-inset-bottom, 0px))", sm: 2 }, gap: 1, "& .MuiButton-root": { minHeight: 46 } }}>
          {payStep === 0 && (
            <>
              <Button onClick={closePayment} sx={{ fontWeight: 700 }}>
                {t("Cancel")}
              </Button>
              <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={goNextStep} disabled={payMethods.length === 0} sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}>
                {t("I've paid")}
              </Button>
            </>
          )}
          {payStep === 1 && (
            <>
              <Button startIcon={<ArrowBackIcon />} onClick={() => setPayStep(0)} disabled={paymentSubmitting} sx={{ fontWeight: 700 }}>
                {t("Back")}
              </Button>
              <Button
                variant="contained"
                onClick={handlePaymentSubmit}
                disabled={paymentSubmitting}
                startIcon={paymentSubmitting ? <CircularProgress size={18} color="inherit" /> : <PaymentIcon />}
                sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}
              >
                {paymentSubmitting ? t("Submitting...") : !online ? t("Save and send later") : multiMonth ? `Submit ${sortedPayMonths.length} months` : t("Submit payment")}
              </Button>
            </>
          )}
          {payStep === 2 && (
            <>
              <Button
                onClick={() => {
                  setOpenPaymentModal(false);
                  goTab("payments");
                }}
                sx={{ fontWeight: 700 }}
              >
                {t("View payments")}
              </Button>
              <Button variant="contained" onClick={() => setOpenPaymentModal(false)} sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}>
                {t("Done")}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ===================== REPAIR: UPDATE / EDIT / CANCEL ===================== */}
      <Dialog
        open={Boolean(ticketDlg.mode)}
        onClose={closeTicketDlg}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: 3, bgcolor: "background.default", m: 2, width: "calc(100% - 32px)", maxHeight: "calc(100% - 32px)" } } }}
      >
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          {ticketDlg.mode === "cancel" ? t("Cancel this request?") : ticketDlg.mode === "edit" ? t("Edit request") : t("Add an update")}
          <IconButton edge="end" aria-label={t("Close")} onClick={closeTicketDlg} disabled={ticketDlg.busy}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {ticketDlg.error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {ticketDlg.error}
            </Alert>
          )}
          {ticketDlg.mode === "cancel" && (
            <Typography variant="body2" color="text.secondary">
              "{ticketDlg.ticket?.title}{t("\" will be removed and your landlord won't see it any more. You can only cancel a request that hasn't been started.")}
            </Typography>
          )}
          {ticketDlg.mode === "edit" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
              <TextField fullWidth required label={t("Title")} value={ticketDlg.title} onChange={(e) => setTicketDlg((d) => ({ ...d, title: e.target.value, error: "" }))} slotProps={{ htmlInput: { maxLength: 100 } }} />
              <TextField fullWidth multiline minRows={3} label={t("Details")} value={ticketDlg.description} onChange={(e) => setTicketDlg((d) => ({ ...d, description: e.target.value }))} slotProps={{ htmlInput: { maxLength: 600 } }} />
            </Box>
          )}
          {ticketDlg.mode === "update" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {t("Something changed, or you have more to tell about \"")}{ticketDlg.ticket?.title}{t("\"? Your landlord is notified.")}
              </Typography>
              <TextField fullWidth multiline minRows={3} label={t("Your message")} value={ticketDlg.text} onChange={(e) => setTicketDlg((d) => ({ ...d, text: e.target.value, error: "" }))} slotProps={{ htmlInput: { maxLength: 400 } }} />
              <PhotoPicker file={ticketDlg.photo} onChange={(f) => setTicketDlg((d) => ({ ...d, photo: f, error: "" }))} onError={(m) => setTicketDlg((d) => ({ ...d, photoError: m }))} disabled={ticketDlg.busy} label={t("Take or choose a photo")} hint={t("Optional")} />
              {ticketDlg.photoError && (
                <Typography variant="caption" color="error">
                  {ticketDlg.photoError}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, "& .MuiButton-root": { minHeight: 46 } }}>
          <Button onClick={closeTicketDlg} disabled={ticketDlg.busy} sx={{ fontWeight: 700, textTransform: "none" }}>
            {ticketDlg.mode === "cancel" ? t("Keep it") : t("Close")}
          </Button>
          <Button
            variant="contained"
            color={ticketDlg.mode === "cancel" ? "error" : "primary"}
            onClick={submitTicketDlg}
            disabled={ticketDlg.busy || !online}
            sx={{ fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}
          >
            {ticketDlg.busy ? t("Please wait...") : ticketDlg.mode === "cancel" ? t("Cancel request") : ticketDlg.mode === "edit" ? t("Save changes") : t("Send update")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== RECEIPT ===================== */}
      <Dialog
        open={!!receipt}
        onClose={() => setReceipt(null)}
        fullWidth
        maxWidth="xs"
        sx={{ "& .MuiDialog-container": { alignItems: { xs: "flex-end", sm: "center" } } }}
        PaperProps={{ sx: { borderRadius: isPhone ? "20px 20px 0 0" : 3, bgcolor: "background.default", m: isPhone ? 0 : undefined, width: "100%", maxHeight: "90dvh" } }}
      >
        {receipt && (
          <>
            <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
              {t("Payment details")}
              <IconButton edge="end" aria-label={t("Close")} onClick={() => setReceipt(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "2rem" }}>{peso(receipt.amount)}</Typography>
                <Pill label={t(receipt.status || "Pending")} tone={paymentTone(receipt.status)} />
              </Box>
              <Facts
                items={[
                  { label: t("Period"), value: receipt.periodMonth || "—" },
                  ...(receipt.receiptNo ? [{ label: t("Receipt no."), value: receipt.receiptNo }] : []),
                  { label: t("Method"), value: receipt.paymentMethod || "—" },
                  { label: t("Reference"), value: receipt.referenceNumber || "—" },
                  { label: t("Payment date"), value: fmtDate(receipt.paymentDate) || "—" },
                  { label: t("Submitted"), value: fmtDate(receipt.createdAt) || "—" },
                  ...(receipt.remarks ? [{ label: t("Remarks"), value: receipt.remarks }] : []),
                  ...(receipt.rejectionReason ? [{ label: t("Owner note"), value: receipt.rejectionReason, color: "error.main" }] : []),
                ]}
              />
              {receipt.proofUrl && (
                <Box component="a" href={receipt.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "block", mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                    {t("Your proof of payment")}
                  </Typography>
                  <Box component="img" src={receipt.proofUrl} alt={t("Proof of payment")} loading="lazy" sx={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: { xs: "calc(12px + env(safe-area-inset-bottom, 0px))", sm: 2 }, "& .MuiButton-root": { minHeight: 46 } }}>
              {receipt.referenceNumber && (
                <Button startIcon={<ContentCopyIcon />} onClick={() => copyText(receipt.referenceNumber, "Reference copied.")} sx={{ fontWeight: 700 }}>
                  {t("Copy reference")}
                </Button>
              )}
              {receipt.receiptNo && ["paid", "partial"].includes(String(receipt.status || "").toLowerCase()) && (
                <Button variant="outlined" startIcon={savingReceipt ? <CircularProgress size={16} /> : <DownloadOutlinedIcon />} disabled={savingReceipt} onClick={() => saveReceipt(receipt)} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
                  {t("Save receipt")}
                </Button>
              )}
              <Button startIcon={<IosShareOutlinedIcon />} onClick={() => sharePayment(receipt)} sx={{ fontWeight: 700 }}>
                {t("Share")}
              </Button>
              <Button variant="contained" onClick={() => setReceipt(null)} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
                {t("Close")}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ===================== MAINTENANCE REQUEST ===================== */}
      <Dialog
        open={openRepairModal}
        onClose={() => !repairSubmitting && setOpenRepairModal(false)}
        fullScreen={isPhone}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "background.default" } }}
      >
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          {t("New maintenance request")}
          <IconButton edge="end" aria-label={t("Close")} onClick={() => setOpenRepairModal(false)} disabled={repairSubmitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                {t("What kind of issue is it?")}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 0.75 }}>
                {CATEGORY_OPTIONS.map((opt) => {
                  const active = repairForm.category === opt.value;
                  return (
                    <Box
                      key={opt.value}
                      component="button"
                      type="button"
                      onClick={() => setRepairForm({ ...repairForm, category: opt.value })}
                      sx={{
                        ...row,
                        gap: 1.5,
                        textAlign: "left",
                        font: "inherit",
                        color: "inherit",
                        cursor: "pointer",
                        p: 1.5,
                        borderRadius: 2.5,
                        border: "1.5px solid",
                        borderColor: active ? "primary.main" : "divider",
                        bgcolor: active ? "rgba(255, 69, 0, 0.07)" : "background.paper",
                      }}
                    >
                      <Box sx={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, ...row, justifyContent: "center", bgcolor: active ? "primary.main" : (t) => alpha(t.palette.text.primary, 0.07), color: active ? "#fff" : "text.secondary" }}>
                        <opt.Icon fontSize="small" />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{opt.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {opt.hint}
                        </Typography>
                      </Box>
                      {active && <CheckCircleOutlinedIcon color="primary" />}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <TextField
              label={t("Issue summary")}
              placeholder={t("e.g. Water leak, light bulb replacement")}
              fullWidth
              size="small"
              value={repairForm.title}
              onChange={(e) => setRepairForm({ ...repairForm, title: e.target.value.slice(0, 80) })}
              error={repairTouched && !repairForm.title.trim()}
              helperText={repairTouched && !repairForm.title.trim() ? t("Add a short summary.") : `${repairForm.title.length}/80`}
            />

            <TextField
              label={t("Detailed description")}
              multiline
              minRows={3}
              fullWidth
              value={repairForm.description}
              onChange={(e) => setRepairForm({ ...repairForm, description: e.target.value.slice(0, 500) })}
              helperText={`${repairForm.description.length}/500`}
            />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
                {t("Photo (optional)")}
              </Typography>
              <PhotoPicker file={repairPhoto} onChange={setRepairPhoto} onError={setRepairPhotoError} disabled={repairSubmitting} label={t("Take or choose a photo")} hint={t("A picture helps your landlord prepare")} />
              {repairPhotoError && (
                <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                  {repairPhotoError}
                </Typography>
              )}
            </Box>

            {!online && (
              <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ borderRadius: 2 }}>
                {t("You're offline. Connect to the internet to send this request.")}
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: { xs: "calc(12px + env(safe-area-inset-bottom, 0px))", sm: 2 }, gap: 1, "& .MuiButton-root": { minHeight: 46 } }}>
          <Button onClick={() => setOpenRepairModal(false)} disabled={repairSubmitting} sx={{ fontWeight: 700 }}>
            {t("Cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleRequestSubmit}
            disabled={repairSubmitting || !online}
            startIcon={repairSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}
          >
            {repairSubmitting ? t("Sending...") : t("Submit request")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom)) !important`, sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}