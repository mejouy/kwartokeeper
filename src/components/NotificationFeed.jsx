import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListSubheader,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import BedtimeOutlinedIcon from "@mui/icons-material/BedtimeOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { collection, onSnapshot, query, updateDoc, where, doc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { t } from "../i18n";

function getDateValue(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

// What a notification is about. Older notifications have no `category`, so it
// is worked out from `kind` and the ids they carry.
function topicOf(n) {
  const kind = String(n.kind || "").toLowerCase();
  const category = String(n.category || "").toLowerCase();
  if (kind.startsWith("maintenance") || category === "maintenance" || n.ticketId) return "maintenance";
  if (kind === "payment" || category === "payment" || n.paymentId) return "payment";
  if (n.reminderDays != null || n.leaseEndDate || /^lease-/.test(String(n.type || ""))) return "lease";
  if (kind === "curfew_alert" || category === "curfew") return "curfew";
  if (n.announcementId) return "announcement";
  return "account";
}

// Where clicking a notification should take you, for the portal it was opened
// in. Owner pages are real routes; tenant and caretaker dashboards switch
// sections with the URL hash. null = nothing to open (it is just marked read).
function linkFor(n, pathname) {
  const topic = topicOf(n);

  if (pathname.startsWith("/admin")) {
    // Admins mostly hear about owner applications
    if (topic === "account") return { pathname: "/admin/owners" };
    return null;
  }

  if (pathname.startsWith("/owner")) {
    if (topic === "maintenance") return { pathname: "/owner/maintenance" };
    if (topic === "payment") return { pathname: "/owner/payments" };
    if (topic === "lease" || topic === "curfew") return { pathname: n.tenantId ? `/owner/tenants/${n.tenantId}` : "/owner/tenants" };
    if (topic === "account") return { pathname: "/owner" };
    return null;
  }

  const hashFor = pathname.startsWith("/caretaker")
    ? { maintenance: "#maintenance", payment: "#payments", lease: "#tenants", curfew: "#tenants" }
    : pathname.startsWith("/tenant")
    ? { maintenance: "#maintenance", payment: "#payments", lease: "#profile", curfew: "", announcement: "", account: "" }
    : null;
  if (!hashFor || !(topic in hashFor)) return null;
  const base = pathname.startsWith("/caretaker") ? "/caretaker/dashboard" : "/tenant/dashboard";
  return { pathname: base, hash: hashFor[topic] };
}

// "5 min ago", "Yesterday, 3:20 PM", "Nov 12"
function formatDate(value) {
  const date = getDateValue(value);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 60 * 1000) return t("Just now");
  if (diff >= 0 && diff < 60 * 60 * 1000) return t("{n} min ago", { n: Math.floor(diff / 60000) });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const dayDiff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 864e5);
  if (dayDiff === 0) return t("Today, {time}", { time });
  if (dayDiff === 1) return t("Yesterday, {time}", { time });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

// Each kind of note gets its own icon and colour, so the list can be scanned
const TOPIC_LOOK = {
  maintenance: { icon: BuildOutlinedIcon, tone: "warning", label: "Repair" },
  payment: { icon: PaymentsOutlinedIcon, tone: "success", label: "Payment" },
  lease: { icon: EventOutlinedIcon, tone: "info", label: "Lease" },
  curfew: { icon: BedtimeOutlinedIcon, tone: "secondary", label: "Curfew" },
  announcement: { icon: CampaignOutlinedIcon, tone: "primary", label: "Announcement" },
  account: { icon: ApartmentOutlinedIcon, tone: "primary", label: "Update" },
};
const lookOf = (n) => {
  const look = TOPIC_LOOK[topicOf(n)] || TOPIC_LOOK.account;
  // A note can flag itself as a problem or a warning
  if (n.type === "error") return { ...look, tone: "error" };
  if (n.type === "warning") return { ...look, tone: "warning" };
  return look;
};
const toneColor = (th, tone) => (tone === "secondary" ? "#3b5b8a" : th.palette[tone]?.main || th.palette.primary.main);
const MAX_SHOWN = 30;

export default function NotificationFeed() {
  const [notifications, setNotifications] = useState([]);
  // Signed out: nothing to load
  const [loading, setLoading] = useState(() => Boolean(auth.currentUser?.uid));
  const [error, setError] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return undefined;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );

    return onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((notificationDoc) => ({
          id: notificationDoc.id,
          ...notificationDoc.data(),
        }));
        rows.sort((first, second) =>
          (getDateValue(second.createdAt)?.getTime() || 0) -
          (getDateValue(first.createdAt)?.getTime() || 0)
        );
        setNotifications(rows);
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error loading notifications:", snapshotError);
        setError("Notifications could not be loaded.");
        setLoading(false);
      }
    );
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications]
  );

  const markAsRead = async (notification) => {
    if (notification.isRead) return;
    try {
      await updateDoc(doc(db, "notifications", notification.id), { isRead: true });
    } catch (updateError) {
      console.error("Error marking notification as read:", updateError);
      setError("Could not mark this notification as read.");
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    setError("");
    try {
      await Promise.all(unreadNotifications.map((notification) =>
        updateDoc(doc(db, "notifications", notification.id), { isRead: true })
      ));
    } catch (updateError) {
      console.error("Error marking notifications as read:", updateError);
      setError("Some notifications could not be marked as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  // Mark it read, close the panel, then go to the page it is about (if any)
  const openNotification = (notification) => {
    markAsRead(notification);
    const target = linkFor(notification, location.pathname);
    if (!target) return;
    setAnchorEl(null);
    navigate(target);
  };

  const open = Boolean(anchorEl);
  const popoverId = open ? "notifications-popover" : undefined;

  return (
    <>
      <Tooltip title={t("Notifications")}>
        <IconButton
          aria-label={`Notifications${unreadNotifications.length ? `, ${unreadNotifications.length} unread` : ""}`}
          aria-describedby={popoverId}
          color="inherit"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <Badge badgeContent={unreadNotifications.length || null} color="error" max={99}>
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: { xs: "calc(100vw - 24px)", sm: 400 }, maxWidth: 400, mt: 1, borderRadius: "16px", bgcolor: "background.default", border: "1px solid", borderColor: "divider", boxShadow: "0 18px 40px -18px rgba(32,32,32,.35)", overflow: "hidden" } } }}
      >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800 }}>{t("Notifications")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {unreadNotifications.length ? `${unreadNotifications.length} unread` : t("You're all caught up")}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={markingAll ? <CircularProgress size={14} /> : <DoneAllIcon />}
            disabled={!unreadNotifications.length || markingAll}
            onClick={markAllAsRead}
            sx={{ fontWeight: 700, textTransform: "none", borderRadius: 99, flexShrink: 0 }}
          >
            {t("Mark all read")}
          </Button>
        </Box>
        <Divider />

        {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: 5, px: 2, textAlign: "center" }}>
            <Box sx={{ width: 48, height: 48, borderRadius: "50%", mx: "auto", mb: 1.25, display: "grid", placeItems: "center", bgcolor: (th) => alpha(th.palette.primary.main, 0.08) }}>
              <NotificationsNoneOutlinedIcon sx={{ color: "primary.main" }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t("No announcements or notifications yet.")}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: "min(480px, calc(100dvh - 160px))", overflowY: "auto", overscrollBehavior: "contain" }}>
            {[
              [t("New"), notifications.filter((n) => !n.isRead).slice(0, MAX_SHOWN)],
              [t("Earlier"), notifications.filter((n) => n.isRead).slice(0, Math.max(MAX_SHOWN - unreadNotifications.length, 0))],
            ]
              .filter(([, list]) => list.length)
              .map(([heading, list]) => (
                <li key={heading}>
                  <ul style={{ padding: 0, margin: 0 }}>
                    <ListSubheader sx={{ lineHeight: "32px", fontSize: 12, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "text.secondary", bgcolor: "background.default" }}>
                      {heading}
                    </ListSubheader>
                    {list.map((notification) => {
                      const hasLink = Boolean(linkFor(notification, location.pathname));
                      const look = lookOf(notification);
                      const Icon = look.icon;
                      const unread = !notification.isRead;
                      return (
                        <ListItem key={notification.id} disablePadding>
                          <ListItemButton
                            onClick={() => openNotification(notification)}
                            aria-label={`${unread ? "Unread. " : ""}${notification.title || "Notification"}${hasLink ? ". Opens the related page." : ""}`}
                            sx={{
                              alignItems: "flex-start",
                              gap: 1.5,
                              py: 1.25,
                              px: 2,
                              position: "relative",
                              bgcolor: unread ? (th) => alpha(th.palette.primary.main, 0.04) : "transparent",
                              "&::before": unread ? { content: '""', position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: "0 3px 3px 0", bgcolor: "primary.main" } : {},
                            }}
                          >
                            <Box sx={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: (th) => alpha(toneColor(th, look.tone), 0.12), color: (th) => toneColor(th, look.tone) }}>
                              <Icon sx={{ fontSize: 20 }} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: unread ? 800 : 600, lineHeight: 1.3, minWidth: 0, overflowWrap: "anywhere" }}>
                                  {notification.title || t("Announcement")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                                  {formatDate(notification.createdAt)}
                                </Typography>
                              </Box>
                              {notification.message && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ mt: 0.25, lineHeight: 1.45, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                                >
                                  {notification.message}
                                </Typography>
                              )}
                              <Typography variant="caption" sx={{ display: "inline-block", mt: 0.5, fontWeight: 700, color: (th) => toneColor(th, look.tone) }}>
                                {t(look.label)}
                                {hasLink && <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>{" · "}{t("Open")}</Box>}
                              </Typography>
                            </Box>
                            {hasLink && <ChevronRightIcon fontSize="small" sx={{ color: "text.disabled", alignSelf: "center", flexShrink: 0 }} />}
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </ul>
                </li>
              ))}
            {notifications.length > MAX_SHOWN && (
              <Typography component="li" variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 1.5 }}>
                {t("Showing the latest {n}.", { n: MAX_SHOWN })}
              </Typography>
            )}
          </List>
        )}
      </Popover>
    </>
  );
}