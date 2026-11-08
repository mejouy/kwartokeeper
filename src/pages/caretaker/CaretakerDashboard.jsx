// src/pages/caretaker/CaretakerDashboard.jsx
//
// One file for the whole caretaker area, designed phone-first. CaretakerLayout
// decides which tab is open (URL hash) and passes it in as `activeTab`
// ("overview" | "tenants" | "maintenance" | "payments").
// Tabs other than the overview only exist when the owner granted the matching
// permission (manageTenants / logOccupancy / handleReports / viewFinancials).

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Fab, IconButton, Paper, Skeleton, Snackbar, Switch, FormControlLabel, TextField, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import CloseIcon from "@mui/icons-material/Close";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import AddIcon from "@mui/icons-material/Add";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WifiOffOutlinedIcon from "@mui/icons-material/WifiOffOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { reserveReceiptNo } from "../../utils/receipt";
import { auth, db } from "../../config/firebase";
import { notifyMaintenanceStatusChanged, notifyCashPaymentRecorded } from "../../services/notificationService";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";
import { getPropertyCoverPhotoUrl } from "../../utils/getPropertyCoverPhotoUrl";
import { normalizePayment } from "../../utils/normalizePayment";
import { withoutRemoved } from "../../utils/accountState";
import { billSnapshot, chargesFor, isActiveCharge, monthBill } from "../../utils/charges";
import { BillBreakdown } from "../../components/Fees";
import { logActivity } from "../../services/activityLog";
import { BOTTOM_NAV_H, row, cardSx, TAB_IDS, NOTICE_DELAY_MS, CHECK_WORD, SMS_URL, HISTORY_NIGHTS, EMPTY_OBJ, CURFEW_WINDOW_MIN, NOTICE_TYPES, DEFAULT_CASH_NOTE, peso, localDateKey, periodLabel, normPeriod, rememberPendingMarks, forgetPendingMarks, readPendingMarks, getTimestampMillis, fmtDate, firstName, initials, payKind, isReceived, LIST_PAGE, ROOM_PAGE, NIGHT_PAGE, isInactiveStatus, addressText, AnimationStyles, Pill, EmptyState, Facts, useOnline, useToday, TabErrorBoundary, parseClock, useClock, buzz, ROOM_STATUS, roomStatusOf, sendNoticeSms } from "./caretakerParts";
import CaretakerOverviewTab from "./CaretakerOverviewTab";
import CaretakerDirectoryView from "./CaretakerDirectoryView";
import CaretakerCurfewView from "./CaretakerCurfewView";
import CaretakerCurfewHistoryView from "./CaretakerCurfewHistoryView";
import CaretakerMaintenanceTab from "./CaretakerMaintenanceTab";
import CaretakerPaymentsTab from "./CaretakerPaymentsTab";
import CaretakerRoomsTab from "./CaretakerRoomsTab";
// Translation is "tr" here: this file also uses "t" for tenants and the theme
import { t as tr } from "../../i18n";

export default function CaretakerDashboard({ activeTab: tabProp, onNavigateTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutletContext();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const online = useOnline();
  const today = useToday();
  const dayKey = localDateKey(today);
  const currentPeriod = periodLabel(today);
  const periodKey = normPeriod(currentPeriod);

  // The tab comes from the layout (props / outlet context) or, failing that, the URL hash
  const hashTab = String(location.hash || "").replace(/^#(caretaker-)?/, "");
  const rawTab = tabProp ?? outlet?.activeTab ?? (hashTab || "overview");
  const requestedTab = rawTab === "occupancy" ? "tenants" : rawTab; // occupancy & curfew now lives with the directory
  const activeTab = TAB_IDS.includes(requestedTab) ? requestedTab : "overview";
  const goTab = (id) => {
    const go = onNavigateTab || outlet?.setActiveTab;
    if (go) go(id);
    else navigate({ hash: id === "overview" ? "" : `#${id}` });
  };

  // ---- load state
  const [loading, setLoading] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [listenError, setListenError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [uid, setUid] = useState("");
  const [profile, setProfile] = useState({ name: "Caretaker", permissions: {}, ownerUid: "" });
  const [property, setProperty] = useState(null);
  const [userTenants, setUserTenants] = useState([]);
  const [legacyTenants, setLegacyTenants] = useState([]);
  const [tickets, setTickets] = useState([]);
  // The owner's extra fees for this property (electricity, Wi-Fi...), on top of rent
  const [charges, setCharges] = useState([]);
  const [payments, setPayments] = useState([]);
  const [coverFailed, setCoverFailed] = useState(false);
  const [occ, setOcc] = useState({ key: "", entries: {}, meta: {}, error: false });
  const [tenantsView, setTenantsView] = useState("");
  const [checkFilter, setCheckFilter] = useState("todo");
  const [checkSearch, setCheckSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("open");
  const [autoNotify, setAutoNotify] = useState(() => {
    try {
      return window.localStorage.getItem("kk_ct_autonotify") !== "off";
    } catch {
      return true;
    }
  });
  const [notice, setNotice] = useState({ open: false, recipients: [], title: "", message: "", type: "info", sending: false, error: "", reminder: false, sms: false });

  // ---- ui state
  const [toast, setToast] = useState({ open: false, message: "", severity: "success", undo: null });
  const notify = (message, severity = "success", undo = null) => setToast({ open: true, message, severity, undo });
  const pendingNotices = useRef({}); // tenantId -> { timer, run }: automatic notices waiting out the undo window
  const [history, setHistory] = useState({ loading: false, loaded: false, nights: [], error: false });
  const [openNight, setOpenNight] = useState("");
  const [cashProof, setCashProof] = useState(null);
  const cashPreviewRef = useRef(null);
  const [pickedRoomId, setPickedRoomId] = useState("");
  const [roomDlg, setRoomDlg] = useState({ open: false, id: "", roomName: "", floor: "1", capacity: "1", rate: "0", saving: false, error: "", confirmDelete: false });
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("active");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [busyTicket, setBusyTicket] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [payFilter, setPayFilter] = useState("all");
  const [payLimit, setPayLimit] = useState(20);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [ticketsShown, setTicketsShown] = useState(LIST_PAGE);
  const [archiveShown, setArchiveShown] = useState(LIST_PAGE);
  const [unpaidShown, setUnpaidShown] = useState(LIST_PAGE);
  const [roomsShown, setRoomsShown] = useState(ROOM_PAGE);
  const [nightsShown, setNightsShown] = useState(NIGHT_PAGE);

  // ---- cash payment dialog
  const [cashOpen, setCashOpen] = useState(false);
  const [cash, setCash] = useState({ tenantId: "", amount: "", periodMonth: currentPeriod, paymentDate: dayKey, notes: DEFAULT_CASH_NOTE });
  const [amountTouched, setAmountTouched] = useState(false);
  const [cashErrors, setCashErrors] = useState({});
  const [cashSaving, setCashSaving] = useState(false);

  const perms = profile.permissions || {};
  const canTenants = perms.manageTenants === true;
  const canOccupancy = perms.logOccupancy === true;
  const canReports = perms.handleReports === true;
  const canFinancials = perms.viewFinancials === true;
  const canLayout = perms.modifyLayout === true;
  const canTenantsTab = canTenants || canOccupancy; // directory and/or occupancy & curfew
  const tabAllowed = { overview: true, tenants: canTenantsTab, maintenance: canReports, payments: canFinancials, rooms: canLayout };

  // ---- load the caretaker, their facility and live data.
  // Waits for Firebase to restore the session (auth.currentUser is null for a
  // moment after a reload, which must not bounce people to the login page).
  useEffect(() => {
    let cancelled = false;
    let unsubs = [];
    const stop = () => {
      unsubs.forEach((u) => u());
      unsubs = [];
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      stop();
      if (!user) {
        if (!cancelled) navigate("/login", { replace: true });
        return;
      }
      try {
        const [userSnap, caretakerSnap] = await Promise.all([getDoc(doc(db, "users", user.uid)), getDoc(doc(db, "caretakers", user.uid))]);
        if (cancelled) return;
        const data = { ...(userSnap.exists() ? userSnap.data() : {}), ...(caretakerSnap.exists() ? caretakerSnap.data() : {}) };
        // Self-heal: the password was already changed (profile says so) but the older
        // caretaker record still asks for it. Clear it so both records agree.
        if (userSnap.exists() && caretakerSnap.exists() && userSnap.data().mustChangePassword === false && caretakerSnap.data().mustChangePassword === true) {
          updateDoc(doc(db, "caretakers", user.uid), {
            mustChangePassword: false,
            passwordChangedAt: userSnap.data().passwordChangedAt || new Date().toISOString(),
          }).catch((err) => console.warn("Couldn't sync the caretaker record:", err?.code || err));
        }
        const granted = data.permissions || {};
        const propertyId = data.assignedPropertyId || data.propertyId || "";
        setUid(user.uid);
        setProfile({ name: data.name || data.fullName || user.displayName || "Caretaker", permissions: granted, ownerUid: data.ownerUid || data.invitedBy || "" });

        if (!propertyId) {
          setProperty(null);
          return;
        }
        const propSnap = await getDoc(doc(db, "properties", propertyId));
        if (cancelled) return;
        if (!propSnap.exists()) {
          setProperty(null);
          setLoadError("The facility assigned to this account could not be found. Please ask the owner to check the assignment.");
          return;
        }
        setProperty({ id: propSnap.id, ...propSnap.data() });
        // Live from here on: rooms, rates, curfew time and house rules the owner changes show right away
        unsubs.push(
          onSnapshot(
            doc(db, "properties", propertyId),
            (snap) => {
              if (!cancelled && snap.exists()) setProperty({ id: snap.id, ...snap.data() });
            },
            (err) => console.warn("Property updates unavailable:", err?.code || err)
          )
        );
        // The owner changed this caretaker's property or permissions: reload so every tab follows
        const accessKey = (d) => JSON.stringify([d.assignedPropertyId || d.propertyId || "", d.permissions || {}]);
        // Compared with the same record the listener watches, so a mismatch with the older caretakers record can never cause a reload loop
        const startedWith = accessKey(userSnap.exists() ? userSnap.data() : {});
        unsubs.push(
          onSnapshot(
            doc(db, "users", user.uid),
            (snap) => {
              if (!cancelled && snap.exists() && !snap.metadata.hasPendingWrites && accessKey(snap.data()) !== startedWith) window.location.reload();
            },
            (err) => console.warn("Account updates unavailable:", err?.code || err)
          )
        );

        const fail = (label) => (err) => {
          console.error(`Caretaker ${label} listener failed:`, err);
          if (!cancelled) setListenError(true);
        };
        unsubs.push(
          onSnapshot(
            query(collection(db, "users"), where("propertyId", "==", propertyId)),
            (snap) => setUserTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.role === "tenant")),
            fail("tenants")
          )
        );
        // Older records live in "tenants"; failing to read them is not fatal
        unsubs.push(
          onSnapshot(
            query(collection(db, "tenants"), where("propertyId", "==", propertyId)),
            (snap) => setLegacyTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
            (err) => console.warn("Legacy tenants unavailable:", err?.code || err)
          )
        );
        if (granted.handleReports === true) {
          unsubs.push(
            onSnapshot(
              query(collection(db, "maintenance_tickets"), where("propertyId", "==", propertyId)),
              (snap) => setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
              fail("maintenance")
            )
          );
        }
        if (granted.viewFinancials === true) {
          unsubs.push(
            onSnapshot(
              query(collection(db, "payments"), where("propertyId", "==", propertyId)),
              (snap) => setPayments(snap.docs.map((d) => normalizePayment({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
              fail("payments")
            )
          );
          if (data.ownerUid) {
            unsubs.push(
              onSnapshot(
                query(collection(db, "charges"), where("ownerUid", "==", data.ownerUid), where("propertyId", "==", propertyId)),
                (snap) => setCharges(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isActiveCharge)),
                // Fees are extra: not being able to read them must not break the page
                (err) => console.warn("Fees unavailable:", err?.code || err)
              )
            );
          }
        }
      } catch (err) {
        console.error("Failed to load caretaker dashboard:", err);
        if (!cancelled) setLoadError("We couldn't load your facility. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      stop();
    };
  }, [navigate, reloadKey]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError("");
    setListenError(false);
    setReloadKey((k) => k + 1);
  };

  // ---- derived: facility
  const rooms = useMemo(() => (Array.isArray(property?.rooms) ? property.rooms : []), [property]);
  const propertyName = property?.propertyName || property?.name || "Your facility";
  const address = addressText(property?.address, property?.fullAddress || "");
  const coverUrl = property ? getPropertyCoverPhotoUrl(property) || property.coverPhotoUrl || "" : "";
  const hasCover = Boolean(coverUrl) && !coverFailed;
  const curfewTime = property ? (property.curfew?.enabled ? property.curfew.startTime || "" : property.curfewEnabled ? property.curfewTime || "" : "") : "";
  const rules = useMemo(() => {
    const r = property?.rules;
    if (Array.isArray(r)) return r.filter((x) => typeof x === "string" && x.trim());
    if (typeof r === "string") return r.split("\n").map((x) => x.trim()).filter(Boolean);
    return [];
  }, [property]);
  const ruleFiles = Array.isArray(property?.ruleFiles) ? property.ruleFiles.filter((f) => f?.url) : [];
  const amenities = Array.isArray(property?.amenities) ? property.amenities.filter((a) => typeof a === "string" && a) : [];
  const hasHouseRules = Boolean(curfewTime) || rules.length > 0 || ruleFiles.length > 0;

  // ---- derived: tenants
  const tenants = useMemo(() => {
    const map = new Map();
    [...legacyTenants, ...userTenants].forEach((t) => {
      if (!t.id) return;
      map.set(t.id, { ...(map.get(t.id) || {}), ...t });
    });
    return withoutRemoved([...map.values()])
      .map((t) => {
        const roomNumber = String(t.roomId || t.roomNumber || t.room || "");
        const room = rooms.find((r) => r.roomName === roomNumber || r.id === roomNumber);
        const status = t.status || "Active";
        return {
          ...t,
          name: t.name || t.fullName || "Tenant",
          roomNumber,
          bedId: t.bedId || t.bedNumber || t.bed || "",
          phone: t.phone || t.contactNumber || t.contact || t.phoneNumber || "",
          status,
          inactive: isInactiveStatus(status),
          leaseStartDate: t.leaseStartDate || t.leaseStart || t.startDate || t.moveInDate || "",
          leaseEndDate: t.leaseEndDate || t.leaseEnd || t.endDate || t.moveOutDate || "",
          rent: Number(t.monthlyRent ?? t.rentAmount ?? t.roomMonthlyRate ?? t.monthlyRate ?? t.rent ?? room?.monthlyRatePerBed ?? 0) || 0,
        };
      })
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  }, [legacyTenants, userTenants, rooms]);
  const activeTenants = useMemo(() => tenants.filter((t) => !t.inactive), [tenants]);
  const rentTenants = useMemo(() => activeTenants.filter((t) => t.roomNumber), [activeTenants]);
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || null;

  const totalRooms = rooms.length;
  const livingIn = (r) => activeTenants.filter((t) => t.roomNumber && (t.roomNumber === r.roomName || t.roomNumber === r.id)).length;
  const occupiedRooms = rooms.filter((r) => livingIn(r) > 0).length;
  const totalBeds = rooms.reduce((n, r) => n + (Number(r.capacity) || 0), 0);
  const bedsUsed = rooms.reduce((n, r) => n + Math.min(livingIn(r), Number(r.capacity) || 0), 0);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (tenantFilter === "active" && t.inactive) return false;
      if (tenantFilter === "inactive" && !t.inactive) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.roomNumber.toLowerCase().includes(q);
    });
  }, [tenants, search, tenantFilter]);

  // ---- derived: rent this month
  // One month for one tenant: rent + the owner's fees, less what was received
  const billOf = (t, period) =>
    monthBill(
      t.rent,
      chargesFor(charges, t.id, period),
      payments.filter((p) => p.tenantId === t.id && normPeriod(p.periodMonth) === normPeriod(period))
    );
  const rentState = (() => {
    const rank = { paid: 4, pending: 3, partial: 2, rejected: 1 };
    const m = {};
    payments.forEach((p) => {
      if (normPeriod(p.periodMonth) !== periodKey) return;
      const k = payKind(p);
      if (!m[p.tenantId] || rank[k] > rank[m[p.tenantId]]) m[p.tenantId] = k;
    });
    // Fees count too: rent marked paid with fees still open is part-paid
    rentTenants.forEach((t) => {
      const bill = billOf(t, currentPeriod);
      if (bill.settled) m[t.id] = "paid";
      else if (m[t.id] === "paid") m[t.id] = "partial";
    });
    return m;
  })();
  const unpaidTenants = rentTenants.filter((t) => !["paid", "pending"].includes(rentState[t.id]));
  const pendingCount = rentTenants.filter((t) => rentState[t.id] === "pending").length;
  const paidCount = rentTenants.filter((t) => rentState[t.id] === "paid").length;
  // Money received this month: full and partial payments (same rule as the owner's Payments page)
  const collected = payments.filter((p) => normPeriod(p.periodMonth) === periodKey && isReceived(p)).reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const sortedPayments = useMemo(() => [...payments].sort((a, b) => getTimestampMillis(b.paymentDate || b.createdAt) - getTimestampMillis(a.paymentDate || a.createdAt)), [payments]);
  const payCounts = useMemo(
    () => ({
      all: payments.length,
      paid: payments.filter((p) => payKind(p) === "paid").length,
      partial: payments.filter((p) => payKind(p) === "partial").length,
      pending: payments.filter((p) => payKind(p) === "pending").length,
      rejected: payments.filter((p) => payKind(p) === "rejected").length,
    }),
    [payments]
  );
  const shownPayments = payFilter === "all" ? sortedPayments : sortedPayments.filter((p) => payKind(p) === payFilter);

  // ---- derived: maintenance
  const rankedTickets = useMemo(() => rankMaintenanceRequests(tickets), [tickets]);
  const activeTickets = rankedTickets.filter((t) => !["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const resolvedTickets = rankedTickets.filter((t) => ["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const highTickets = activeTickets.filter((t) => t.priority?.tier === "High");
  const progressTickets = activeTickets.filter((t) => (t.status || "Pending") === "In Progress");
  const shownTickets = ticketFilter === "high" ? highTickets : ticketFilter === "progress" ? progressTickets : activeTickets;

  // ---- derived: curfew + tonight's check
  // A curfew "night" starts at the curfew time and runs past midnight, so a check
  // made at 1 AM still belongs to the evening before.
  const clock = useClock(true);
  const curfewMin = parseClock(curfewTime);
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  let nightKey = localDateKey(clock);
  let curfewPhase = "none"; // none | before | active
  let minsUntil = 0;
  if (curfewMin !== null) {
    const since = (nowMin - curfewMin + 1440) % 1440;
    if (since < CURFEW_WINDOW_MIN) {
      curfewPhase = "active";
      if (nowMin < curfewMin) nightKey = localDateKey(new Date(clock.getTime() - 86400000));
    } else {
      curfewPhase = "before";
      minsUntil = (curfewMin - nowMin + 1440) % 1440;
    }
  }
  const pastCurfew = curfewPhase === "active";
  // Tonight's sheet; switching property or night shows it empty until that night's document answers
  const occKey = property?.id && canOccupancy ? `${property.id}_${nightKey}` : "";
  const occCurrent = Boolean(occKey) && occ.key === occKey;
  const occEntries = occCurrent ? occ.entries : EMPTY_OBJ;
  const occMeta = occCurrent ? occ.meta : EMPTY_OBJ;
  const occError = occCurrent && occ.error;
  const checkTenants = rentTenants;
  const entryOf = (t) => occEntries[t.id] || null;
  const statusOf = (t) => occEntries[t.id]?.status || "";
  const checkCounts = {
    present: checkTenants.filter((t) => statusOf(t) === "present").length,
    late: checkTenants.filter((t) => statusOf(t) === "late").length,
    out: checkTenants.filter((t) => statusOf(t) === "out").length,
  };
  const checkedCount = checkCounts.present + checkCounts.late + checkCounts.out;
  const uncheckedCount = checkTenants.length - checkedCount;
  const checkQuery = checkSearch.trim().toLowerCase();
  const shownChecks = checkTenants.filter(
    (t) =>
      (checkFilter === "all" ? true : checkFilter === "todo" ? !statusOf(t) : statusOf(t) === checkFilter) &&
      (!checkQuery || t.name.toLowerCase().includes(checkQuery) || t.roomNumber.toLowerCase().includes(checkQuery))
  );
  const minsLabel = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
  const curfewHeadline =
    curfewPhase === "none" ? "No curfew set for this property" : curfewPhase === "active" ? `Curfew in effect since ${curfewTime}` : minsUntil <= 120 ? `Curfew in ${minsLabel(minsUntil)} (${curfewTime})` : `Curfew tonight at ${curfewTime}`;

  // Tonight's check: one document per facility per curfew night
  useEffect(() => {
    if (!occKey) return undefined;
    return onSnapshot(
      doc(db, "occupancy_logs", occKey),
      { includeMetadataChanges: true },
      (snap) => {
        const data = snap.exists() ? snap.data({ serverTimestamps: "estimate" }) : {};
        setOcc({ key: occKey, entries: data.entries || {}, meta: { reminderSentAt: data.reminderSentAt || null, pending: snap.metadata.hasPendingWrites }, error: false });
      },
      (err) => {
        console.warn("Occupancy log unavailable:", err?.code || err);
        setOcc((o) => ({ ...(o.key === occKey ? o : { entries: {}, meta: {} }), key: occKey, error: true }));
      }
    );
  }, [occKey]);

  const ownerUidValue = property?.ownerUid || profile.ownerUid || "";

  // Recorded for the owner (Caretakers → this caretaker → Activity). Best effort.
  const logAction = (category, summary, extra = {}) =>
    logActivity({ ownerUid: profile.ownerUid || ownerUidValue, actorName: profile.name, category, summary, propertyId: property?.id || "", propertyName, ...extra });

  // Leaving the page shouldn't swallow an automatic notice that was waiting out its undo window
  useEffect(
    () => () => {
      Object.values(pendingNotices.current).forEach((p) => {
        clearTimeout(p.timer);
        p.run();
      });
      pendingNotices.current = {};
    },
    []
  );

  /* -------------------------------------------------------------------------
     Actions
  ------------------------------------------------------------------------- */
  const changeTicketStatus = async (t, next) => {
    const prev = t.status || "Pending";
    if (prev === next || busyTicket) return;
    if (!online) {
      notify("You're offline. Connect to the internet to update requests.", "warning");
      return;
    }
    setBusyTicket(t.id);
    try {
      await updateDoc(doc(db, "maintenance_tickets", t.id), {
        status: next,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
        ...(next === "Resolved" ? { resolvedAt: serverTimestamp() } : {}),
      });
      notifyMaintenanceStatusChanged(t, next, "caretaker");
      logAction("repair", `Changed repair request "${t.title || "Untitled"}" from ${prev} to ${next}`, { action: "repair.status", targetId: t.id, targetName: t.title || "", details: { from: prev, to: next } });
      const tenantId = t.tenantUid || t.tenantId;
      if (tenantId && property?.id) {
        const title = t.title || "your request";
        const text =
          next === "Resolved"
            ? `Your repair request "${title}" has been marked as resolved.`
            : next === "In Progress"
              ? `Work has started on your repair request "${title}".`
              : `Your repair request "${title}" is back to pending.`;
        pushNotices([{ userId: tenantId, kind: "notice", category: "maintenance", type: next === "Resolved" ? "success" : "info", title: `Repair update: ${next}`, message: text }]).catch((err) => console.warn("Repair notice failed:", err?.code || err));
      }
      notify(next === "Resolved" ? "Marked as resolved and moved to the archive." : `Marked as ${next.toLowerCase()}.`);
    } catch (err) {
      console.error("Failed to update ticket status:", err);
      notify("Couldn't update that request. Please try again.", "error");
    } finally {
      setBusyTicket("");
    }
  };

  // ---- curfew check + notices
  const pushNotices = async (items) => {
    const nowIso = new Date().toISOString();
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      items.slice(i, i + 400).forEach((it) => {
        batch.set(doc(collection(db, "notifications")), {
          category: "curfew",
          ...it,
          propertyId: property.id,
          ownerId: ownerUidValue,
          createdBy: uid,
          createdByRole: "caretaker",
          senderName: profile.name,
          isRead: false,
          createdAt: nowIso,
        });
      });
      await batch.commit();
    }
  };

  // `night` is only passed when re-sending marks saved on this phone from an earlier night
  const writeChecks = (entries, extra = {}, night = nightKey) => {
    if (!property?.id) return;
    // A copy stays on this phone until the server has it, so marks made offline
    // survive closing the app (sent again by the effect below)
    const version = rememberPendingMarks(uid, property.id, night, entries);
    setDoc(
      doc(db, "occupancy_logs", `${property.id}_${night}`),
      { propertyId: property.id, propertyName, ownerUid: ownerUidValue, date: night, curfewTime: curfewTime || "", entries, updatedAt: serverTimestamp(), recordedBy: uid, recordedByName: profile.name, ...extra },
      { merge: true }
    )
      .then(() => forgetPendingMarks(uid, property.id, night, version))
      .catch((err) => {
        console.error("Failed to save curfew check:", err);
        notify("Couldn't save that check. Please try again.", "error");
      });
    // Each tenant also gets a private record of their own night, so they can see it without seeing anyone else's
    Object.entries(entries).forEach(([tenantId, e]) => {
      if (!e || typeof e !== "object" || !e.status) return;
      setDoc(
        doc(db, "curfew_records", `${property.id}_${night}_${tenantId}`),
        { tenantId, propertyId: property.id, ownerUid: ownerUidValue, date: night, curfewTime: curfewTime || "", status: e.status, name: e.name || "", roomNumber: e.roomNumber || "", at: e.at || serverTimestamp(), recordedBy: uid, recordedByName: profile.name },
        { merge: true }
      ).catch((err) => console.warn("Tenant curfew record not saved:", err?.code || err));
    });
  };

  // Back online (or the app was reopened): send marks that never reached the server
  const resentPending = useRef(false);
  useEffect(() => {
    if (!online || !uid || !property?.id || !canOccupancy || resentPending.current) return;
    resentPending.current = true;
    Object.entries(readPendingMarks(uid, property.id)).forEach(([night, stored]) => writeChecks(stored, {}, night));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, uid, property?.id, canOccupancy]);
  useEffect(() => {
    if (!online) resentPending.current = false;
  }, [online]);

  const undoChecks = (prev) => {
    Object.keys(prev).forEach((id) => {
      const pending = pendingNotices.current[id];
      if (pending) {
        clearTimeout(pending.timer);
        delete pendingNotices.current[id];
      }
    });
    writeChecks(Object.fromEntries(Object.entries(prev).map(([id, e]) => [id, e ? { ...e, noticeSent: e.noticeSent ?? deleteField() } : deleteField()])));
    const undone = Object.keys(prev).map((id) => tenants.find((x) => x.id === id)?.name).filter(Boolean);
    if (undone.length) logAction("curfew", `Undid the curfew mark for ${undone.length === 1 ? undone[0] : `${undone.length} tenants`}`, { action: "curfew.undo" });
    Object.entries(prev).forEach(([tenantId, e]) => {
      if (!e && property?.id) deleteDoc(doc(db, "curfew_records", `${property.id}_${nightKey}_${tenantId}`)).catch(() => {});
    });
    setToast((x) => ({ ...x, open: false }));
  };

  const setCheck = (t, status) => {
    const existing = occEntries[t.id];
    if (existing?.status === status) return;
    const entry = { name: t.name, roomNumber: t.roomNumber, status, at: serverTimestamp(), by: profile.name };
    const waiting = pendingNotices.current[t.id];
    if (waiting) {
      clearTimeout(waiting.timer);
      delete pendingNotices.current[t.id];
    }
    // Automated notices go out after a short moment so a mis-tap can still be undone
    const willNotify = autoNotify && (status === "late" || status === "out") && existing?.noticeSent !== status;
    if (willNotify) {
      const clockText = curfewTime || "curfew";
      const run = () => {
        delete pendingNotices.current[t.id];
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        const items = [
          status === "out"
            ? { userId: t.id, kind: "notice", type: "error", title: "Out past curfew", message: `You were recorded as out past curfew (${clockText}). Please contact your caretaker as soon as you can.` }
            : { userId: t.id, kind: "notice", type: "warning", title: "Marked late for curfew", message: `You were recorded as arriving after curfew (${clockText}). Please follow the house rules.` },
        ];
        if (status === "out" && ownerUidValue) {
          items.push({ userId: ownerUidValue, kind: "curfew_alert", type: "warning", tenantId: t.id, title: `${t.name} is out past curfew`, message: `Room ${t.roomNumber} · curfew ${clockText}. Recorded by ${profile.name}.` });
        }
        pushNotices(items)
          .then(() => writeChecks({ [t.id]: { noticeSent: status } }))
          .catch((err) => console.warn("Automatic notice failed:", err?.code || err));
      };
      pendingNotices.current[t.id] = { timer: setTimeout(run, NOTICE_DELAY_MS), run };
    }
    buzz();
    writeChecks({ [t.id]: entry });
    logAction("curfew", `Marked ${t.name}${t.roomNumber ? ` (Room ${t.roomNumber})` : ""} as ${CHECK_WORD[status]}${existing?.status ? ` (was ${CHECK_WORD[existing.status] || existing.status})` : ""}`, { action: "curfew.mark", targetId: t.id, targetName: t.name, details: { status, ...(existing?.status ? { was: existing.status } : {}) } });
    notify(`${firstName(t.name)} marked ${CHECK_WORD[status]}${willNotify ? ". Notifying them in a moment" : ""}.`, "success", () => undoChecks({ [t.id]: existing || null }));
  };

  const markMany = (list, message) => {
    if (list.length === 0) return;
    buzz();
    const prev = Object.fromEntries(list.map((t) => [t.id, occEntries[t.id] || null]));
    writeChecks(Object.fromEntries(list.map((t) => [t.id, { name: t.name, roomNumber: t.roomNumber, status: "present", at: serverTimestamp(), by: profile.name }])));
    logAction("curfew", `Marked ${list.length === 1 ? list[0].name : `${list.length} tenants`} as in`, { action: "curfew.mark_many" });
    notify(message, "success", () => undoChecks(prev));
  };

  const markAllPresent = () => {
    const pending = checkTenants.filter((t) => !statusOf(t));
    markMany(pending, `${pending.length} ${pending.length === 1 ? "tenant" : "tenants"} marked as in.`);
  };

  const openCurfewCheck = () => {
    setTenantsView("curfew");
    goTab("tenants");
  };

  const markRoomIn = (list) => {
    const pending = list.filter((t) => statusOf(t) !== "present");
    markMany(pending, `${pending.length} marked as in.`);
  };

  const openDirectory = () => {
    setTenantsView("directory");
    goTab("tenants");
  };

  const toggleAutoNotify = (on) => {
    setAutoNotify(on);
    try {
      window.localStorage.setItem("kk_ct_autonotify", on ? "on" : "off");
    } catch {
      /* storage unavailable: the choice just lasts until reload */
    }
  };

  const openNotice = (recipients, preset = {}) =>
    setNotice({ open: true, recipients, title: preset.title || "Notice from your caretaker", message: preset.message || "", type: preset.type || "info", sending: false, error: "", reminder: Boolean(preset.reminder) });
  const reminderPreset = {
    reminder: true,
    type: "warning",
    title: "Curfew reminder",
    message: curfewTime ? `Curfew is at ${curfewTime}. Please make sure you're back at ${propertyName} before then.` : `Please be back at ${propertyName} on time tonight.`,
  };
  const remindRecipients = checkTenants.filter((t) => statusOf(t) !== "present");
  const sendNotice = async () => {
    const message = notice.message.trim();
    const title = notice.title.trim() || "Notice from your caretaker";
    if (!message) {
      setNotice((n) => ({ ...n, error: "Write a message first." }));
      return;
    }
    if (!online) {
      setNotice((n) => ({ ...n, error: "You're offline. Connect to the internet to send notices." }));
      return;
    }
    setNotice((n) => ({ ...n, sending: true, error: "" }));
    try {
      await pushNotices(notice.recipients.map((r) => ({ userId: r.id, kind: "notice", type: notice.type, title, message })));
      if (notice.reminder) writeChecks({}, { reminderSentAt: serverTimestamp() });
      const n = notice.recipients.length;
      logAction("notice", `Sent the notice "${title}" to ${n === 1 ? notice.recipients[0].name || "1 tenant" : `${n} tenants`}`, { action: "notice.send", details: { message: message.slice(0, 200) } });
      let smsNote = "";
      if (notice.sms && SMS_URL) {
        const res = await sendNoticeSms({ tenantIds: notice.recipients.map((r) => r.id), title, message, propertyId: property.id });
        smsNote = res.ok ? ` Texts: ${res.sent} sent${res.skipped ? `, ${res.skipped} skipped (no number)` : ""}${res.failed ? `, ${res.failed} failed` : ""}.` : ` The text messages didn't go out: ${res.error}`;
      }
      setNotice((x) => ({ ...x, open: false, sending: false }));
      notify(`Notice sent to ${n} ${n === 1 ? "tenant" : "tenants"}.${smsNote}`, smsNote.includes("didn't") ? "warning" : "success");
    } catch (err) {
      console.error("Failed to send notice:", err);
      setNotice((x) => ({ ...x, sending: false, error: "Couldn't send the notice. Please try again." }));
    }
  };

  // cash payments
  const periodOptions = useMemo(() => [1, 0, -1, -2, -3, -4, -5].map((o) => periodLabel(new Date(today.getFullYear(), today.getMonth() + o, 1))), [today]);
  const cashTenants = useMemo(() => [...activeTenants].sort((a, b) => a.name.localeCompare(b.name)), [activeTenants]);
  const cashTenant = tenants.find((t) => t.id === cash.tenantId) || null;
  const cashExisting = payments.filter((p) => p.tenantId === cash.tenantId && normPeriod(p.periodMonth) === normPeriod(cash.periodMonth));
  const cashPaid = cashExisting.some((p) => payKind(p) === "paid");
  const cashPending = cashExisting.some((p) => payKind(p) === "pending");
  const cashReceivedBefore = cashExisting.filter(isReceived).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // What's still owed for that month: rent + fees, less what was already received
  const cashBill = cashTenant ? billOf(cashTenant, cash.periodMonth) : null;
  const cashBalance = cashBill && cashBill.total > 0 ? cashBill.balance : null;
  const cashAmountNum = Number(cash.amount) || 0;
  // Less than what's still owed for that month = a partial payment
  const cashStatus = cashBalance !== null && cashAmountNum > 0 && cashAmountNum < cashBalance ? "Partial" : "Paid";

  const openCash = (tenantId = "") => {
    const t = tenants.find((x) => x.id === tenantId);
    const owed = t ? billOf(t, currentPeriod).balance : 0;
    setCash({ tenantId, amount: owed > 0 ? String(owed) : t?.rent ? String(t.rent) : "", periodMonth: currentPeriod, paymentDate: dayKey, notes: DEFAULT_CASH_NOTE });
    setCashProof(null);
    setAmountTouched(false);
    setCashErrors({});
    setCashOpen(true);
  };
  useEffect(() => {
    if (!cashProof || !cashPreviewRef.current) return undefined;
    const url = URL.createObjectURL(cashProof);
    cashPreviewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [cashProof]);
  const pickProof = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setCashErrors((er) => ({ ...er, form: "Choose a photo (JPG or PNG)." }));
    if (file.size > 10 * 1024 * 1024) return setCashErrors((er) => ({ ...er, form: "That photo is too large. Choose one under 10 MB." }));
    setCashErrors((er) => ({ ...er, form: undefined }));
    setCashProof(file);
  };
  const closeCash = () => {
    if (!cashSaving) setCashOpen(false);
  };
  const pickCashTenant = (id) => {
    const t = tenants.find((x) => x.id === id);
    // Suggest what's still owed for the month (rent + fees if nothing was paid yet)
    const owed = t ? billOf(t, cash.periodMonth).balance : 0;
    setCash((c) => ({ ...c, tenantId: id, amount: !amountTouched && owed > 0 ? String(owed) : c.amount }));
    setCashErrors((e) => ({ ...e, tenantId: undefined }));
  };
  const submitCash = (e) => {
    e?.preventDefault();
    const errs = {};
    if (!cash.tenantId) errs.tenantId = "Choose a tenant.";
    if (!(Number(cash.amount) > 0)) errs.amount = "Enter an amount above zero.";
    if (!cash.paymentDate || getTimestampMillis(cash.paymentDate) === 0) errs.paymentDate = "Choose the date you received the cash.";
    else if (cash.paymentDate > dayKey) errs.paymentDate = "The date can't be in the future.";
    setCashErrors(errs);
    if (Object.keys(errs).length === 0) saveCash();
  };
  const saveCash = async () => {
    if (cashSaving || !cashTenant || !property) return;
    if (!online) {
      notify("You're offline. Connect to the internet to record a payment.", "warning");
      return;
    }
    setCashSaving(true);
    try {
      let proofUrl = "";
      if (cashProof) {
        try {
          proofUrl = await uploadToCloudinary(cashProof);
        } catch (uploadErr) {
          console.error("Cash proof upload failed:", uploadErr);
          setCashErrors({ form: "The photo couldn't be uploaded. Try again, or remove it to save without it." });
          return;
        }
      }
      // The property's owner: their receipt counter numbers this receipt right away
      const cashOwnerUid = property.ownerUid || cashTenant.ownerUid || profile.ownerUid || "";
      const cashRef = doc(collection(db, "payments"));
      const cashPayment = {
        tenantId: cashTenant.id,
        tenantName: cashTenant.name,
        propertyId: property.id,
        propertyName,
        roomNumber: cashTenant.roomNumber || "N/A",
        amount: Number(cash.amount),
        paymentMethod: "Cash",
        periodMonth: cash.periodMonth,
        status: cashStatus,
        verificationStatus: "Approved",
        remarks: cash.notes.trim(),
        // What the month was billed at (rent + fees), for the receipt
        bill: billSnapshot(cashTenant.rent, chargesFor(charges, cashTenant.id, cash.periodMonth)),
        ownerUid: cashOwnerUid,
        paymentDate: new Date(`${cash.paymentDate}T12:00:00`),
        createdAt: serverTimestamp(),
        recordedBy: uid,
        recordedByName: profile.name,
        recordedByRole: "caretaker",
        ...(proofUrl ? { proofUrl } : {}),
      };
      let receiptNo = "";
      try {
        await runTransaction(db, async (tx) => {
          const issued = await reserveReceiptNo(tx, db, cashOwnerUid, cashRef.id);
          receiptNo = issued.receiptNo;
          tx.set(cashRef, { ...cashPayment, ...issued });
        });
      } catch (receiptErr) {
        // Couldn't take a number (e.g. no access to the counter): save it anyway; the owner numbers it later
        console.warn("Receipt number not issued:", receiptErr?.code || receiptErr);
        receiptNo = "";
        await setDoc(cashRef, cashPayment);
      }
      const leftAfter = cashBalance !== null ? Math.max(cashBalance - cashAmountNum, 0) : 0;
      logAction("payment", `Recorded ${peso(cash.amount)} cash from ${cashTenant.name} for ${cash.periodMonth}${cashStatus === "Partial" ? ` (partial, ${peso(leftAfter)} left)` : ""}`, { action: "payment.cash", targetId: cashRef.id, targetName: cashTenant.name, details: { amount: Number(cash.amount), period: cash.periodMonth, status: cashStatus } });
      pushNotices([
        {
          userId: cashTenant.id,
          kind: "payment",
          category: "payment",
          type: "success",
          title: cashStatus === "Partial" ? "Partial cash payment recorded" : "Cash payment recorded",
          message:
            cashStatus === "Partial"
              ? `Your caretaker recorded your ${peso(cash.amount)} cash payment for ${cash.periodMonth}. ${peso(leftAfter)} is still due for that month.${receiptNo ? ` Receipt No. ${receiptNo} is in your Payments tab.` : ""}`
              : `Your caretaker recorded your ${peso(cash.amount)} cash payment for ${cash.periodMonth}. Thank you!${receiptNo ? ` Receipt No. ${receiptNo} is in your Payments tab.` : ""}`,
        },
      ]).catch((err) => console.warn("Cash notice failed:", err?.code || err));
      notifyCashPaymentRecorded(
        {
          id: cashRef.id,
          tenantName: cashTenant.name,
          roomNumber: cashTenant.roomNumber,
          amount: Number(cash.amount),
          periodMonth: cash.periodMonth,
          propertyId: property.id,
          ownerUid: cashTenant.ownerUid || property.ownerUid || profile.ownerUid || "",
        },
        "caretaker",
      );
      setCashOpen(false);
      notify(`Recorded ${peso(cash.amount)} from ${cashTenant.name}${cashStatus === "Partial" ? " as a partial payment" : ""}${receiptNo ? ` · Receipt No. ${receiptNo}` : ""}.`);
    } catch (err) {
      console.error("Failed to record cash payment:", err);
      setCashErrors({ form: "Couldn't record the payment. Please try again." });
    } finally {
      setCashSaving(false);
    }
  };

  const viewOptions = [canTenants && "directory", canOccupancy && "curfew", canOccupancy && "history"].filter(Boolean);
  const tenantsViewNow = viewOptions.includes(tenantsView) ? tenantsView : viewOptions[0] || "directory";

  // Past nights: one small read per night (no index needed), loaded when the history view opens
  const fetchHistoryNights = async () => {
    const [y, m, d] = nightKey.split("-").map(Number);
    const keys = Array.from({ length: HISTORY_NIGHTS }, (_, i) => localDateKey(new Date(y, m - 1, d - i)));
    const snaps = await Promise.all(keys.map((k) => getDoc(doc(db, "occupancy_logs", `${property.id}_${k}`))));
    return snaps
      .map((snap, i) => (snap.exists() ? { key: keys[i], ...snap.data({ serverTimestamps: "estimate" }) } : null))
      .filter(Boolean);
  };
  // Refresh button
  const loadHistory = async () => {
    if (!property?.id) return;
    setHistory((h) => ({ ...h, loading: true, error: false }));
    try {
      const nights = await fetchHistoryNights();
      setHistory({ loading: false, loaded: true, nights, error: false });
    } catch (err) {
      console.warn("Curfew history unavailable:", err?.code || err);
      setHistory((h) => ({ ...h, loading: false, error: true }));
    }
  };
  // First open of the history view
  const historyWanted = tenantsViewNow === "history" && activeTab === "tenants" && Boolean(property?.id);
  const historyLoading = history.loading || (historyWanted && !history.loaded && !history.error);
  useEffect(() => {
    if (!historyWanted || history.loaded || history.error) return undefined;
    let active = true;
    fetchHistoryNights()
      .then((nights) => {
        if (active) setHistory({ loading: false, loaded: true, nights, error: false });
      })
      .catch((err) => {
        console.warn("Curfew history unavailable:", err?.code || err);
        if (active) setHistory((h) => ({ ...h, loading: false, error: true }));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyWanted, history.loaded, history.error, property?.id]);

  const roomsByFloor = useMemo(() => {
    const m = new Map();
    rooms.forEach((r, index) => {
      const f = Number(r.floor) || 1;
      if (!m.has(f)) m.set(f, []);
      m.get(f).push({ ...r, index });
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rooms]);
  /* -------------------------------------------------------------------------
     Early states
  ------------------------------------------------------------------------- */
  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={200} sx={{ borderRadius: 4, mb: 2 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5, mb: 2 }}>
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} variant="rounded" height={96} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  if (loadError || !property) {
    return (
      <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
        <EmptyState
          icon={<ErrorOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
          title={loadError ? "We couldn't open your dashboard" : "No facility assigned yet"}
          body={loadError || "Ask the property owner to assign a facility to your caretaker account."}
          action={
            <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={retryLoad} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
              {loadError ? tr("Try again") : tr("Check again")}
            </Button>
          }
        />
      </Paper>
    );
  }

  const locked = (what) => (
    <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
      <EmptyState
        icon={<InfoOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
        title={tr("Not enabled for your account")}
        body={`${what} access hasn't been turned on by the property owner.`}
        action={
          <Button variant="outlined" onClick={() => goTab("overview")} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5 }}>
            {tr("Back to overview")}
          </Button>
        }
      />
    </Paper>
  );

  /* -------------------------------------------------------------------------
     Overview
  ------------------------------------------------------------------------- */
  const attention = [];
  if (canOccupancy && pastCurfew && (checkCounts.out > 0 || uncheckedCount > 0)) {
    attention.push({
      key: "curfew",
      tone: checkCounts.out > 0 ? "error" : "warning",
      icon: ScheduleIcon,
      title: checkCounts.out > 0 ? `${checkCounts.out} ${checkCounts.out === 1 ? "tenant is" : "tenants are"} out past curfew` : "Curfew has started",
      body: `${uncheckedCount} of ${checkTenants.length} ${uncheckedCount === 1 ? "tenant isn't" : "tenants aren't"} checked yet.`,
      actionLabel: tr("Open curfew check"),
      onAction: openCurfewCheck,
    });
  } else if (canOccupancy && curfewPhase === "before" && minsUntil <= 60 && uncheckedCount > 0) {
    attention.push({ key: "curfew", tone: "info", icon: ScheduleIcon, title: `Curfew in ${minsLabel(minsUntil)}`, body: tr("Get ready for tonight's check, or send everyone a reminder."), actionLabel: tr("Open curfew check"), onAction: openCurfewCheck });
  }
  if (canReports && highTickets.length > 0) {
    attention.push({
      key: "urgent",
      tone: "error",
      title: highTickets.length === 1 ? "1 high-priority request" : `${highTickets.length} high-priority requests`,
      body: highTickets[0].title ? `Most urgent: ${highTickets[0].title}${highTickets[0].roomNumber ? ` (Room ${highTickets[0].roomNumber})` : ""}` : undefined,
      actionLabel: tr("Review"),
      onAction: () => goTab("maintenance"),
    });
  }
  if (canFinancials && unpaidTenants.length > 0) {
    attention.push({
      key: "unpaid",
      tone: "warning",
      title: unpaidTenants.length === 1 ? `1 tenant hasn't paid for ${currentPeriod}` : `${unpaidTenants.length} tenants haven't paid for ${currentPeriod}`,
      actionLabel: tr("See who"),
      onAction: () => goTab("payments"),
    });
  }
  if (listenError) {
    attention.push({ key: "listen", tone: "warning", title: tr("Some information couldn't be loaded"), body: tr("Check your connection or ask the owner to review your access."), actionLabel: tr("Retry"), onAction: retryLoad });
  }

  const quickActions = [
    canOccupancy && { key: "curfew", icon: <ScheduleIcon fontSize="small" />, label: tr("Curfew check"), badge: pastCurfew ? checkCounts.out : 0, onClick: openCurfewCheck },
    canReports && { key: "requests", icon: <BuildOutlinedIcon fontSize="small" />, label: tr("Requests"), badge: activeTickets.length, onClick: () => goTab("maintenance") },
    canFinancials && { key: "cash", icon: <PaymentIcon fontSize="small" />, label: tr("Record cash"), onClick: () => openCash() },
    canTenants && { key: "tenants", icon: <PeopleAltOutlinedIcon fontSize="small" />, label: tr("Tenants"), onClick: openDirectory },
  ].filter(Boolean);

  const overview = (
    <CaretakerOverviewTab
      activeTenants={activeTenants}
      activeTickets={activeTickets}
      address={address}
      amenities={amenities}
      attention={attention}
      attentionOpen={attentionOpen}
      bedsUsed={bedsUsed}
      canFinancials={canFinancials}
      canOccupancy={canOccupancy}
      canReports={canReports}
      canTenantsTab={canTenantsTab}
      checkCounts={checkCounts}
      checkTenants={checkTenants}
      checkedCount={checkedCount}
      collected={collected}
      coverUrl={coverUrl}
      curfewPhase={curfewPhase}
      curfewTime={curfewTime}
      currentPeriod={currentPeriod}
      goTab={goTab}
      hasCover={hasCover}
      hasHouseRules={hasHouseRules}
      highTickets={highTickets}
      minsLabel={minsLabel}
      minsUntil={minsUntil}
      occupiedRooms={occupiedRooms}
      openCurfewCheck={openCurfewCheck}
      openDirectory={openDirectory}
      paidCount={paidCount}
      previewFile={previewFile}
      profile={profile}
      property={property}
      propertyName={propertyName}
      quickActions={quickActions}
      rentTenants={rentTenants}
      ruleFiles={ruleFiles}
      rules={rules}
      rulesOpen={rulesOpen}
      setAttentionOpen={setAttentionOpen}
      setCoverFailed={setCoverFailed}
      setPreviewFile={setPreviewFile}
      setRulesOpen={setRulesOpen}
      totalBeds={totalBeds}
      totalRooms={totalRooms}
      uncheckedCount={uncheckedCount}
    />
  );

  /* -------------------------------------------------------------------------
     Tenants
  ------------------------------------------------------------------------- */
  const directoryView = (
    <CaretakerDirectoryView
      activeTenants={activeTenants}
      canFinancials={canFinancials}
      canOccupancy={canOccupancy}
      curfewTime={curfewTime}
      filteredTenants={filteredTenants}
      occupiedRooms={occupiedRooms}
      rentState={rentState}
      roomsShown={roomsShown}
      search={search}
      setRoomsShown={setRoomsShown}
      setSearch={setSearch}
      setSelectedTenantId={setSelectedTenantId}
      setTenantFilter={setTenantFilter}
      tenantFilter={tenantFilter}
      tenants={tenants}
      totalRooms={totalRooms}
    />
  );

  const curfewView = (
    <CaretakerCurfewView
      autoNotify={autoNotify}
      checkCounts={checkCounts}
      checkFilter={checkFilter}
      checkQuery={checkQuery}
      checkSearch={checkSearch}
      checkTenants={checkTenants}
      checkedCount={checkedCount}
      curfewHeadline={curfewHeadline}
      curfewPhase={curfewPhase}
      entryOf={entryOf}
      markAllPresent={markAllPresent}
      markRoomIn={markRoomIn}
      occError={occError}
      occMeta={occMeta}
      online={online}
      openNotice={openNotice}
      pastCurfew={pastCurfew}
      remindRecipients={remindRecipients}
      reminderPreset={reminderPreset}
      setCheck={setCheck}
      setCheckFilter={setCheckFilter}
      setCheckSearch={setCheckSearch}
      shownChecks={shownChecks}
      statusOf={statusOf}
      toggleAutoNotify={toggleAutoNotify}
      uncheckedCount={uncheckedCount}
    />
  );

  const historyView = (
    <CaretakerCurfewHistoryView
      historyLoading={historyLoading}
      loadHistory={loadHistory}
      nightsShown={nightsShown}
      openNight={openNight}
      setNightsShown={setNightsShown}
      setOpenNight={setOpenNight}
    />
  );

  const tenantsTab = (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tenantsViewNow === "curfew" ? tr("Record who is in tonight, see who is out past curfew, and send notices.") : tenantsViewNow === "history" ? `Curfew records for the last ${HISTORY_NIGHTS} nights.` : tr("Who lives where. Tap a tenant for contact details.")}
      </Typography>
      {viewOptions.length > 1 && (
        <Box sx={{ display: "flex", gap: 0.75, p: 0.5, mb: 2, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.06) }} role="group" aria-label={tr("Tenants view")}>
          {[
            { id: "directory", label: tr("Directory") },
            { id: "curfew", label: tr("Curfew check"), badge: pastCurfew ? checkCounts.out : 0 },
            { id: "history", label: tr("History") },
          ]
            .filter((v) => viewOptions.includes(v.id))
            .map((v) => (
              <Button
                key={v.id}
                onClick={() => setTenantsView(v.id)}
                aria-pressed={tenantsViewNow === v.id}
                variant={tenantsViewNow === v.id ? "contained" : "text"}
                color={tenantsViewNow === v.id ? "primary" : "inherit"}
                sx={{ flex: 1, minWidth: 0, minHeight: 42, px: 1, fontWeight: 800, fontSize: { xs: 13, sm: 14 }, whiteSpace: "nowrap", borderRadius: 2.5, textTransform: "none", boxShadow: "none", color: tenantsViewNow === v.id ? undefined : "text.secondary" }}
              >
                {v.label}
                {v.badge > 0 && <Chip size="small" color="error" label={v.badge} sx={{ ml: 0.75, height: 20, fontWeight: 800 }} />}
              </Button>
            ))}
        </Box>
      )}
      {tenantsViewNow === "curfew" ? curfewView : tenantsViewNow === "history" ? historyView : directoryView}
    </>
  );

  /* -------------------------------------------------------------------------
     Maintenance
  ------------------------------------------------------------------------- */
  const maintenanceTab = (
    <CaretakerMaintenanceTab
      activeTickets={activeTickets}
      archiveOpen={archiveOpen}
      archiveShown={archiveShown}
      busyTicket={busyTicket}
      changeTicketStatus={changeTicketStatus}
      highTickets={highTickets}
      progressTickets={progressTickets}
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

  /* -------------------------------------------------------------------------
     Payments
  ------------------------------------------------------------------------- */
  const paymentsTab = (
    <CaretakerPaymentsTab
      billOf={billOf}
      collected={collected}
      currentPeriod={currentPeriod}
      isPhone={isPhone}
      openCash={openCash}
      paidCount={paidCount}
      payCounts={payCounts}
      payFilter={payFilter}
      payLimit={payLimit}
      payments={payments}
      pendingCount={pendingCount}
      rentState={rentState}
      rentTenants={rentTenants}
      setPayFilter={setPayFilter}
      setPayLimit={setPayLimit}
      setUnpaidShown={setUnpaidShown}
      shownPayments={shownPayments}
      unpaidShown={unpaidShown}
      unpaidTenants={unpaidTenants}
    />
  );

  /* -------------------------------------------------------------------------
     Rooms & rates (modifyLayout)
  ------------------------------------------------------------------------- */
  const occupantsOf = (room) => activeTenants.filter((t) => t.roomNumber === room.roomName || t.roomNumber === room.id).length;
  const roomBeds = rooms.reduce((n, r) => n + (Number(r.capacity) || 0), 0);

  const openRoom = (room = null) =>
    setRoomDlg({
      open: true,
      id: room?.id || "",
      roomName: room?.roomName || "",
      floor: String(room?.floor || 1),
      capacity: String(room?.capacity || 1),
      rate: String(room?.monthlyRatePerBed || 0),
      saving: false,
      error: "",
      confirmDelete: false,
    });
  const editingRoom = roomDlg.id ? rooms.find((r) => r.id === roomDlg.id) : null;
  const editingOccupants = editingRoom ? occupantsOf(editingRoom) : 0;

  const saveRooms = async (nextRooms, successMessage, logSummary) => {
    setRoomDlg((d) => ({ ...d, saving: true, error: "" }));
    try {
      const patch = {
        rooms: nextRooms,
        totalRooms: nextRooms.length,
        totalBeds: nextRooms.reduce((n, r) => n + (Number(r.capacity) || 0), 0),
        totalFloors: Math.max(1, ...nextRooms.map((r) => Number(r.floor) || 1)),
        updatedAt: new Date(),
      };
      await updateDoc(doc(db, "properties", property.id), patch);
      if (logSummary) logAction("rooms", logSummary, { action: "rooms.update" });
      setProperty((p) => ({ ...p, ...patch }));
      setRoomDlg((d) => ({ ...d, open: false, saving: false }));
      notify(successMessage);
    } catch (err) {
      console.error("Failed to save rooms:", err);
      setRoomDlg((d) => ({ ...d, saving: false, error: "Couldn't save. Check your connection, or ask the owner whether you have permission to edit rooms." }));
    }
  };
  const submitRoom = (e) => {
    e?.preventDefault();
    const name = roomDlg.roomName.trim();
    const floor = Math.max(1, Math.round(Number(roomDlg.floor) || 0));
    const capacity = Math.round(Number(roomDlg.capacity) || 0);
    const rate = Number(roomDlg.rate);
    if (!name) return setRoomDlg((d) => ({ ...d, error: "Give the room a name or number." }));
    if (rooms.some((r) => r.id !== roomDlg.id && String(r.roomName).trim().toLowerCase() === name.toLowerCase())) return setRoomDlg((d) => ({ ...d, error: "Another room already uses that name." }));
    if (capacity < 1) return setRoomDlg((d) => ({ ...d, error: "A room needs at least one bed." }));
    if (capacity < editingOccupants) return setRoomDlg((d) => ({ ...d, error: `${editingOccupants} ${editingOccupants === 1 ? "tenant lives" : "tenants live"} here, so it needs at least ${editingOccupants} ${editingOccupants === 1 ? "bed" : "beds"}.` }));
    // Tenants are linked to their room by its name, so renaming would leave them without a room
    if (editingRoom && editingOccupants > 0 && name !== String(editingRoom.roomName).trim())
      return setRoomDlg((d) => ({ ...d, error: `${editingOccupants} ${editingOccupants === 1 ? "tenant is" : "tenants are"} assigned to ${editingRoom.roomName}. Ask the owner to move them before renaming the room.` }));
    if (!(rate >= 0)) return setRoomDlg((d) => ({ ...d, error: "Enter the monthly rate per bed (0 or more)." }));
    if (editingRoom) {
      // Only what actually changed goes in the owner's activity log
      const changes = [
        String(editingRoom.roomName).trim() !== name && `name ${editingRoom.roomName} → ${name}`,
        (Number(editingRoom.floor) || 1) !== floor && `floor ${Number(editingRoom.floor) || 1} → ${floor}`,
        (Number(editingRoom.capacity) || 0) !== capacity && `beds ${Number(editingRoom.capacity) || 0} → ${capacity}`,
        (Number(editingRoom.monthlyRatePerBed) || 0) !== rate && `rate per bed ${peso(editingRoom.monthlyRatePerBed)} → ${peso(rate)}`,
      ].filter(Boolean);
      saveRooms(
        rooms.map((r) => (r.id === roomDlg.id ? { ...r, roomName: name, floor, capacity, monthlyRatePerBed: rate } : r)),
        `Saved ${name}.`,
        changes.length ? `Edited ${editingRoom.roomName}: ${changes.join(", ")}` : ""
      );
    } else {
      saveRooms([...rooms, { id: `room_${Date.now()}`, roomName: name, floor, capacity, occupiedBeds: 0, monthlyRatePerBed: rate }], `Added ${name}.`, `Added ${name} (floor ${floor}, ${capacity} ${capacity === 1 ? "bed" : "beds"}, ${peso(rate)} per bed)`);
    }
  };
  const removeRoom = () => {
    if (!editingRoom || editingOccupants > 0) return;
    saveRooms(rooms.filter((r) => r.id !== roomDlg.id), `Removed ${editingRoom.roomName}.`, `Removed ${editingRoom.roomName}`);
  };

  const takenOf = (r) => occupantsOf(r);
  const bedsTaken = rooms.reduce((n, r) => n + Math.min(takenOf(r), Number(r.capacity) || 0), 0);
  const vacantRooms = rooms.filter((r) => takenOf(r) === 0).length;
  const occPct = roomBeds ? Math.round((bedsTaken / roomBeds) * 100) : 0;
  const pickedRoom = rooms.find((r) => r.id === pickedRoomId) || null;
  const pickedTenants = pickedRoom ? activeTenants.filter((t) => t.roomNumber === pickedRoom.roomName || t.roomNumber === pickedRoom.id) : [];
  const pickedStatus = pickedRoom ? roomStatusOf(pickedRoom.capacity, pickedTenants.length) : "vacant";

  const roomPanel = pickedRoom ? (
    <Box>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", minWidth: 0 }} noWrap>
          {pickedRoom.roomName}
        </Typography>
        <Pill label={ROOM_STATUS[pickedStatus].label} tone={pickedStatus === "full" ? "error" : pickedStatus === "partial" ? "warning" : "default"} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tr("Floor")}{" "}{pickedRoom.floor || 1} · {pickedTenants.length}/{Number(pickedRoom.capacity) || 0}{" "}{tr("beds taken ·")}{" "}{peso(pickedRoom.monthlyRatePerBed)}{" "}{tr("per bed")}
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
        TENANTS
      </Typography>
      {pickedTenants.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
          {tr("No one is assigned to this room.")}
        </Typography>
      ) : (
        <Box sx={{ mt: 0.5 }}>
          {pickedTenants.map((t) => (
            <Box key={t.id} sx={{ ...row, gap: 1.25, py: 1 }}>
              <Avatar sx={{ width: 36, height: 36, fontSize: "0.85rem", fontWeight: 800, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>{initials(t.name)}</Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>
                  {t.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {t.bedId ? `Bed ${t.bedId}` : tr("No bed assigned")}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Button fullWidth variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => openRoom(pickedRoom)} sx={{ mt: 2, minHeight: 48, fontWeight: 800, borderRadius: 2.5, textTransform: "none" }}>
        {tr("Edit room and rate")}
      </Button>
    </Box>
  ) : null;

  const roomsTab = (
    <CaretakerRoomsTab
      bedsTaken={bedsTaken}
      isDesktop={isDesktop}
      occPct={occPct}
      openRoom={openRoom}
      pickedRoom={pickedRoom}
      pickedRoomId={pickedRoomId}
      roomBeds={roomBeds}
      roomPanel={roomPanel}
      rooms={rooms}
      roomsByFloor={roomsByFloor}
      setPickedRoomId={setPickedRoomId}
      takenOf={takenOf}
      vacantRooms={vacantRooms}
    />
  );

  const fabAction = isPhone && activeTab === "payments" && canFinancials ? { label: tr("Record cash"), icon: <AddIcon sx={{ mr: 0.75 }} />, onClick: () => openCash() } : null;
  const navVisible = Object.values(tabAllowed).filter(Boolean).length > 1;

  const bottomOffset = navVisible ? `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom))` : "calc(16px + env(safe-area-inset-bottom))";
  const dialogPaper = { sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "background.default" } };
  const tabBody = {
    overview,
    tenants: canTenantsTab ? tenantsTab : locked("Tenant directory"),
    maintenance: canReports ? maintenanceTab : locked("Maintenance"),
    payments: canFinancials ? paymentsTab : locked("Financials"),
    rooms: canLayout ? roomsTab : locked("Rooms & rates"),
  }[activeTab];

  return (
    <Box>
      {AnimationStyles}

      {!online && (
        <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          {tr("You're offline. Curfew marks are saved on this phone and sent when you're back online. Requests, notices and payments need a connection.")}
        </Alert>
      )}
      {online && listenError && activeTab !== "overview" && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={retryLoad} sx={{ fontWeight: 700 }}>
              {tr("Retry")}
            </Button>
          }
        >
          {tr("Some information couldn't be loaded.")}
        </Alert>
      )}

      <TabErrorBoundary resetKey={activeTab}>{tabBody}</TabErrorBoundary>

      {fabAction && <Box sx={{ height: 72 }} />}
      {fabAction && !cashOpen && (
        <Fab color="primary" variant="extended" onClick={fabAction.onClick} sx={{ position: "fixed", right: 16, bottom: bottomOffset, fontWeight: 700, textTransform: "none" }}>
          {fabAction.icon} {fabAction.label}
        </Fab>
      )}

      {/* ===================== TENANT DETAILS ===================== */}
      <Dialog open={Boolean(selectedTenant)} onClose={() => setSelectedTenantId("")} fullScreen={isPhone} fullWidth maxWidth="xs" slotProps={{ paper: dialogPaper }}>
        {selectedTenant && (
          <>
            <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
              {tr("Tenant details")}
              <IconButton aria-label={tr("Close")} onClick={() => setSelectedTenantId("")} edge="end">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ textAlign: "center", pt: 1, pb: 2 }}>
                <Avatar sx={{ width: 72, height: 72, mx: "auto", mb: 1.5, fontSize: "1.5rem", fontWeight: 800, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>{initials(selectedTenant.name)}</Avatar>
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.25rem", overflowWrap: "anywhere" }}>{selectedTenant.name}</Typography>
                <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, flexWrap: "wrap", mt: 1 }}>
                  <Pill label={selectedTenant.status} tone={selectedTenant.inactive ? "default" : "success"} />
                  {selectedTenant.roomNumber && <Pill label={`Room ${selectedTenant.roomNumber}`} icon={<HomeWorkOutlinedIcon />} />}
                </Box>
              </Box>

              {canOccupancy && !selectedTenant.inactive && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<NotificationsActiveOutlinedIcon />}
                  onClick={() => {
                    const x = selectedTenant;
                    setSelectedTenantId("");
                    openNotice([x]);
                  }}
                  sx={{ mb: 1, minHeight: 46, fontWeight: 700, borderRadius: 2.5, textTransform: "none" }}
                >
                  {tr("Send an in-app notice")}
                </Button>
              )}
              <Facts
                items={[
                  { label: tr("Room"), value: selectedTenant.roomNumber ? `Room ${selectedTenant.roomNumber}` : "Not assigned" },
                  ...(selectedTenant.bedId ? [{ label: tr("Bed"), value: selectedTenant.bedId }] : []),
                  { label: tr("Phone"), value: selectedTenant.phone || "Not provided" },
                  ...(selectedTenant.email ? [{ label: tr("Email"), value: selectedTenant.email }] : []),
                  ...(fmtDate(selectedTenant.leaseStartDate) ? [{ label: tr("Lease start"), value: fmtDate(selectedTenant.leaseStartDate) }] : []),
                  ...(fmtDate(selectedTenant.leaseEndDate) ? [{ label: tr("Lease end"), value: fmtDate(selectedTenant.leaseEndDate) }] : []),
                  ...(canFinancials && selectedTenant.rent ? [{ label: tr("Monthly rent"), value: peso(selectedTenant.rent) }] : []),
                  ...(canFinancials && !selectedTenant.inactive && selectedTenant.roomNumber
                    ? [{ label: currentPeriod.split(" ")[0], value: rentState[selectedTenant.id] === "paid" ? "Paid" : rentState[selectedTenant.id] === "pending" ? "Waiting for verification" : "Unpaid", color: rentState[selectedTenant.id] === "paid" ? "success.main" : rentState[selectedTenant.id] === "pending" ? "warning.main" : "error.main" }]
                    : []),
                ]}
              />
            </DialogContent>
            {canFinancials && !selectedTenant.inactive && selectedTenant.roomNumber && !["paid", "pending"].includes(rentState[selectedTenant.id]) && (
              <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => {
                    const id = selectedTenant.id;
                    setSelectedTenantId("");
                    openCash(id);
                  }}
                  sx={{ minHeight: 48, fontWeight: 800, borderRadius: 2.5, textTransform: "none" }}
                >
                  {tr("Record cash payment")}
                </Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>

      {/* ===================== SEND A NOTICE ===================== */}
      <Dialog open={notice.open} onClose={() => !notice.sending && setNotice((n) => ({ ...n, open: false }))} fullScreen={isPhone} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaper }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          {tr("Send a notice")}
          <IconButton aria-label={tr("Close")} onClick={() => setNotice((n) => ({ ...n, open: false }))} disabled={notice.sending} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {notice.error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {notice.error}
            </Alert>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            TO
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5, mb: 2 }}>
            {notice.recipients.slice(0, 4).map((r) => (
              <Pill key={r.id} label={`${r.name}${r.roomNumber ? ` · ${r.roomNumber}` : ""}`} />
            ))}
            {notice.recipients.length > 4 && <Pill label={`+${notice.recipients.length - 4} more`} />}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            {tr("QUICK MESSAGES")}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 0.5, mb: 2 }}>
            {[
              { label: tr("Curfew reminder"), ...reminderPreset, reminder: notice.reminder },
              { label: tr("See the caretaker"), title: tr("Please see the caretaker"), type: "info", message: tr("Please drop by the caretaker when you have a moment.") },
              { label: tr("Past curfew"), title: "Out past curfew", type: "error", message: `You're recorded as out past curfew${curfewTime ? ` (${curfewTime})` : ""}. Please contact your caretaker as soon as you can.` },
            ].map((q) => (
              <Chip key={q.label} label={q.label} clickable variant="outlined" onClick={() => setNotice((n) => ({ ...n, title: q.title, message: q.message, type: q.type }))} sx={{ fontWeight: 700, height: 36, borderRadius: 18 }} />
            ))}
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField fullWidth label={tr("Title")} value={notice.title} onChange={(e) => setNotice((n) => ({ ...n, title: e.target.value }))} slotProps={{ htmlInput: { maxLength: 80 } }} />
            <TextField
              fullWidth
              required
              multiline
              minRows={3}
              label={tr("Message")}
              value={notice.message}
              onChange={(e) => setNotice((n) => ({ ...n, message: e.target.value, error: "" }))}
              helperText={`${notice.message.length}/300`}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                IMPORTANCE
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, mt: 0.5 }}>
                {NOTICE_TYPES.map((o) => (
                  <Chip key={o.id} label={o.label} clickable onClick={() => setNotice((n) => ({ ...n, type: o.id }))} color={notice.type === o.id ? (o.id === "info" ? "primary" : o.id) : "default"} variant={notice.type === o.id ? "filled" : "outlined"} sx={{ fontWeight: 700, height: 36, borderRadius: 18 }} />
                ))}
              </Box>
            </Box>
            {SMS_URL && (
              <FormControlLabel
                control={<Switch checked={notice.sms} onChange={(e) => setNotice((n) => ({ ...n, sms: e.target.checked }))} />}
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>{tr("Also send as a text message")}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tr("Reaches tenants who aren't using the app. Tenants without a number are skipped.")}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", m: 0, "& .MuiSwitch-root": { mr: 1 } }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {tr("Tenants see this in their Announcements and notification bell.")}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", gap: 1 }}>
          <Button onClick={() => setNotice((n) => ({ ...n, open: false }))} disabled={notice.sending} sx={{ minHeight: 46, fontWeight: 700, textTransform: "none" }}>
            {tr("Cancel")}
          </Button>
          <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={sendNotice} disabled={notice.sending || !notice.recipients.length} sx={{ minHeight: 46, fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}>
            {notice.sending ? tr("Sending...") : `Send to ${notice.recipients.length}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== RECORD CASH PAYMENT ===================== */}
      <Dialog open={cashOpen} onClose={closeCash} fullScreen={isPhone} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaper }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          {tr("Record cash payment")}
          <IconButton aria-label={tr("Close")} onClick={closeCash} disabled={cashSaving} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={submitCash} noValidate sx={{ display: "contents" }}>
          <DialogContent>
            {cashErrors.form && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {cashErrors.form}
              </Alert>
            )}
            {!online && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                {tr("You're offline. You can fill this in, but it can't be saved until you reconnect.")}
              </Alert>
            )}

            {(
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
                <TextField
                  select
                  fullWidth
                  required
                  label={tr("Tenant")}
                  value={cash.tenantId}
                  onChange={(e) => pickCashTenant(e.target.value)}
                  error={Boolean(cashErrors.tenantId)}
                  helperText={cashErrors.tenantId}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                >
                  <option value="">{tr("Choose a tenant")}</option>
                  {cashTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.roomNumber ? ` (Room ${t.roomNumber})` : ""}
                    </option>
                  ))}
                </TextField>

                {cashPaid && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    {cashTenant?.name || tr("This tenant")}{" "}{tr("already has a paid record for")}{" "}{cash.periodMonth}{tr(". Double-check before saving another.")}
                  </Alert>
                )}
                {!cashPaid && cashPending && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    {cashTenant?.name || tr("This tenant")}{" "}{tr("already sent a payment for")}{" "}{cash.periodMonth}{" "}{tr("that's waiting for verification. Check with the owner first so it isn't counted twice.")}
                  </Alert>
                )}

                <TextField
                  fullWidth
                  required
                  label={tr("Amount (₱)")}
                  type="number"
                  value={cash.amount}
                  onChange={(e) => {
                    setAmountTouched(true);
                    setCash((c) => ({ ...c, amount: e.target.value }));
                    setCashErrors((er) => ({ ...er, amount: undefined }));
                  }}
                  error={Boolean(cashErrors.amount)}
                  helperText={
                    cashErrors.amount ||
                    (cashBill && cashBill.total > 0
                      ? cashReceivedBefore > 0
                        ? `${cashBill.feeTotal > 0 ? "Rent + fees" : "Rent"} ${peso(cashBill.total)} · already received ${peso(cashReceivedBefore)} · ${peso(cashBalance)} left`
                        : cashBill.feeTotal > 0
                          ? `Rent + fees for the month: ${peso(cashBill.total)}`
                          : `Monthly rent: ${peso(cashBill.total)}`
                      : undefined)
                  }
                  slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "any" } }}
                />
                {cashBill && cashBill.fees.length > 0 && (
                  <Box sx={{ px: 1.5, py: 1, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                    <BillBreakdown bill={cashBill} />
                  </Box>
                )}

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                  <TextField
                    select
                    fullWidth
                    label={tr("Rent for")}
                    value={cash.periodMonth}
                    onChange={(e) => {
                      const period = e.target.value;
                      const owed = cashTenant ? billOf(cashTenant, period).balance : 0;
                      setCash((c) => ({ ...c, periodMonth: period, amount: !amountTouched && owed > 0 ? String(owed) : c.amount }));
                    }}
                    slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  >
                    {periodOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    label={tr("Date received")}
                    type="date"
                    value={cash.paymentDate}
                    onChange={(e) => {
                      setCash((c) => ({ ...c, paymentDate: e.target.value }));
                      setCashErrors((er) => ({ ...er, paymentDate: undefined }));
                    }}
                    error={Boolean(cashErrors.paymentDate)}
                    helperText={cashErrors.paymentDate}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: dayKey } }}
                  />
                </Box>

                {cashTenant && cashAmountNum > 0 && cashBalance !== null && (
                  <Alert severity={cashStatus === "Partial" ? "info" : "success"} sx={{ borderRadius: 2 }}>
                    {cashStatus === "Partial"
                      ? `Saved as a partial payment. ${peso(cashBalance - cashAmountNum)} will still be due for ${cash.periodMonth}.`
                      : cashAmountNum > cashBalance && cashBalance > 0
                        ? `That's ${peso(cashAmountNum - cashBalance)} more than what's left for ${cash.periodMonth}. Saved as paid.`
                        : `This settles ${cash.periodMonth} in full.`}
                  </Alert>
                )}

                <TextField fullWidth label={tr("Notes (optional)")} multiline minRows={2} value={cash.notes} onChange={(e) => setCash((c) => ({ ...c, notes: e.target.value }))} />

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {tr("PHOTO OF THE RECEIPT OR CASH (OPTIONAL)")}
                  </Typography>
                  {cashProof ? (
                    <Box sx={{ ...row, gap: 1.5, mt: 0.75 }}>
                      <Box component="img" ref={cashPreviewRef} alt={tr("Selected photo")} sx={{ width: 72, height: 72, borderRadius: 2, objectFit: "cover", border: "1px solid", borderColor: "divider" }} />
                      <Button color="inherit" onClick={() => setCashProof(null)} disabled={cashSaving} sx={{ fontWeight: 700, textTransform: "none", minHeight: 44 }}>
                        {tr("Remove")}
                      </Button>
                    </Box>
                  ) : (
                    <Button component="label" role={undefined} variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />} disabled={cashSaving} sx={{ mt: 0.75, display: "flex", minHeight: 48, borderRadius: 2.5, fontWeight: 700, textTransform: "none" }}>
                      {tr("Take or choose a photo")}
                      <input hidden type="file" accept="image/*" onChange={pickProof} />
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", gap: 1 }}>
            <Button onClick={closeCash} disabled={cashSaving} sx={{ minHeight: 46, fontWeight: 700, textTransform: "none" }}>
              {tr("Cancel")}
            </Button>
            <Button type="submit" variant="contained" disabled={cashSaving || !online} sx={{ minHeight: 46, fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}>
              {cashSaving ? tr("Saving...") : cashStatus === "Partial" ? tr("Save partial payment") : tr("Save cash payment")}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ===================== ROOM EDITOR ===================== */}
      <Dialog open={roomDlg.open} onClose={() => !roomDlg.saving && setRoomDlg((d) => ({ ...d, open: false }))} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3, bgcolor: "background.default", m: 2, width: "calc(100% - 32px)", maxHeight: "calc(100% - 32px)" } } }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          {editingRoom ? `Edit ${editingRoom.roomName}` : tr("Add a room")}
          <IconButton aria-label={tr("Close")} onClick={() => setRoomDlg((d) => ({ ...d, open: false }))} disabled={roomDlg.saving} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={submitRoom} noValidate sx={{ display: "contents" }}>
          <DialogContent>
            {roomDlg.error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {roomDlg.error}
              </Alert>
            )}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
              <TextField
                fullWidth
                required
                label={tr("Room name or number")}
                value={roomDlg.roomName}
                onChange={(e) => setRoomDlg((d) => ({ ...d, roomName: e.target.value, error: "" }))}
                disabled={editingOccupants > 0}
                helperText={editingOccupants > 0 ? "Can't rename a room while tenants are assigned to it." : undefined}
                slotProps={{ htmlInput: { maxLength: 40 } }}
              />
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
                <TextField fullWidth label={tr("Floor")} type="number" value={roomDlg.floor} onChange={(e) => setRoomDlg((d) => ({ ...d, floor: e.target.value, error: "" }))} slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }} />
                <TextField fullWidth label={tr("Beds")} type="number" value={roomDlg.capacity} onChange={(e) => setRoomDlg((d) => ({ ...d, capacity: e.target.value, error: "" }))} slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }} />
              </Box>
              <TextField
                fullWidth
                label={tr("Monthly rate per bed (₱)")}
                type="number"
                value={roomDlg.rate}
                onChange={(e) => setRoomDlg((d) => ({ ...d, rate: e.target.value, error: "" }))}
                helperText={editingRoom ? "The new rate shows as the rent for tenants here. Past payments aren't changed." : undefined}
                slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "any" } }}
              />
              {editingRoom && (
                <Box sx={{ pt: 1 }}>
                  {editingOccupants > 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      {editingOccupants} {editingOccupants === 1 ? tr("tenant lives") : tr("tenants live")}{" "}{tr("here, so this room can't be removed.")}
                    </Typography>
                  ) : roomDlg.confirmDelete ? (
                    <Box sx={{ ...row, gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, flex: "1 1 100%" }}>
                        {tr("Remove")}{" "}{editingRoom.roomName}{" "}{tr("for good?")}
                      </Typography>
                      <Button color="error" variant="contained" onClick={removeRoom} disabled={roomDlg.saving} sx={{ minHeight: 44, fontWeight: 800, textTransform: "none" }}>
                        {tr("Yes, remove it")}
                      </Button>
                      <Button color="inherit" onClick={() => setRoomDlg((d) => ({ ...d, confirmDelete: false }))} sx={{ minHeight: 44, fontWeight: 700, textTransform: "none" }}>
                        {tr("Keep")}
                      </Button>
                    </Box>
                  ) : (
                    <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setRoomDlg((d) => ({ ...d, confirmDelete: true }))} sx={{ minHeight: 44, fontWeight: 700, textTransform: "none" }}>
                      {tr("Remove this room")}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", gap: 1 }}>
            <Button onClick={() => setRoomDlg((d) => ({ ...d, open: false }))} disabled={roomDlg.saving} sx={{ minHeight: 46, fontWeight: 700, textTransform: "none" }}>
              {tr("Cancel")}
            </Button>
            <Button type="submit" variant="contained" disabled={roomDlg.saving || !online} sx={{ minHeight: 46, fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}>
              {roomDlg.saving ? tr("Saving...") : editingRoom ? tr("Save room") : tr("Add room")}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.undo ? 6000 : 4000}
        onClose={(e, reason) => {
          if (reason !== "clickaway") setToast((t) => ({ ...t, open: false }));
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `${bottomOffset} !important`, sm: undefined } }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2, width: "100%", alignItems: "center" }}
          action={
            toast.undo ? (
              <Button color="inherit" size="small" onClick={toast.undo} sx={{ fontWeight: 800, minHeight: 36 }}>
                {tr("Undo")}
              </Button>
            ) : undefined
          }
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}