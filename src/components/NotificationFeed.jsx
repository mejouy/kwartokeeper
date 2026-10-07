import { useEffect, useMemo, useState } from "react";
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
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { collection, onSnapshot, query, updateDoc, where, doc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

function getDateValue(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = getDateValue(value);
  if (!date) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationFeed() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return undefined;
    }

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

  const open = Boolean(anchorEl);
  const popoverId = open ? "notifications-popover" : undefined;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          aria-label={`Notifications${unreadNotifications.length ? `, ${unreadNotifications.length} unread` : ""}`}
          aria-describedby={popoverId}
          color="inherit"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <Badge badgeContent={unreadNotifications.length} color="error" max={99}>
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
        slotProps={{ paper: { sx: { width: { xs: "calc(100vw - 24px)", sm: 380 }, maxWidth: 380, mt: 1 } } }}
      >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
            <Typography variant="caption" color="text.secondary">
              {unreadNotifications.length ? `${unreadNotifications.length} unread` : "You're all caught up"}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={markingAll ? <CircularProgress size={14} /> : <DoneAllIcon />}
            disabled={!unreadNotifications.length || markingAll}
            onClick={markAllAsRead}
          >
            Mark all read
          </Button>
        </Box>
        <Divider />

        {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: 4, px: 2, textAlign: "center" }}>
            <CampaignOutlinedIcon sx={{ color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No announcements or notifications yet.
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 440, overflowY: "auto" }}>
            {notifications.slice(0, 20).map((notification) => (
              <ListItem key={notification.id} disablePadding divider>
                <ListItemButton
                  onClick={() => markAsRead(notification)}
                  sx={{ alignItems: "flex-start", gap: 1.5, py: 1.5, bgcolor: notification.isRead ? "transparent" : "action.hover" }}
                >
                  <CampaignOutlinedIcon color={notification.type === "error" ? "error" : notification.type === "warning" ? "warning" : "primary"} sx={{ mt: 0.25 }} />
                  <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={notification.isRead ? 500 : 700} sx={{ flex: 1 }}>
                        {notification.title || "Announcement"}
                      </Typography>
                      {!notification.isRead && <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0 }} />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {formatDate(notification.createdAt)}
                    </Typography>
                  </Stack>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}