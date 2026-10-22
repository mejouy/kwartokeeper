// One app frame for the tenant, caretaker and admin areas, in the same design as
// the owner area (OwnerLayout): a light sidebar with grouped links and a profile
// card on desktop, a top bar with the page title and notifications, and a
// bottom bar with a highlighted pill on phones. Log out lives in the profile
// card / profile menu, never next to the bell where it's easy to tap by mistake.
import { useEffect, useState } from "react";
import {
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationFeed from "../components/NotificationFeed";

const SHELL_DRAWER_W = 288;
const BAR_H = { xs: 56, md: 72 }; // same as the owner area
const HEAD = '"Inter", sans-serif';
const ACTIVE_BG = "rgba(255, 69, 0, 0.10)";
const BOTTOM_MAX = 5; // more than this and the rest go behind "Menu"

// Sidebar colours: light (owner, tenant, caretaker) or dark (admin)
const SIDEBAR = {
  light: {
    bg: "background.default",
    border: "divider",
    logo: "/KwartoKeeper-Secondary-Logo.png",
    heading: "text.disabled",
    item: "text.secondary",
    itemHover: "text.primary",
    hoverBg: "action.hover",
    activeBg: ACTIVE_BG,
    activeHoverBg: "rgba(255, 69, 0, 0.14)",
    active: "primary.main",
    activeIcon: "primary.main",
    cardBg: (theme) => alpha(theme.palette.background.paper, 0.6),
    name: "text.primary",
    subtitle: "text.secondary",
    logout: "error.main",
    logoutHover: "rgba(211, 47, 47, 0.08)",
  },
  dark: {
    bg: "#202020",
    border: "rgba(255,255,255,0.10)",
    logo: "/KwartoKeeper-DarkMode.png",
    heading: "rgba(255,255,255,0.42)",
    item: "rgba(255,255,255,0.74)",
    itemHover: "#ffffff",
    hoverBg: "rgba(255,255,255,0.07)",
    activeBg: "rgba(255, 69, 0, 0.20)",
    activeHoverBg: "rgba(255, 69, 0, 0.28)",
    active: "#ffffff",
    activeIcon: "#ff6a33",
    cardBg: "rgba(255,255,255,0.06)",
    name: "#ffffff",
    subtitle: "rgba(255,255,255,0.6)",
    logout: "#ff8a80",
    logoutHover: "rgba(255, 138, 128, 0.12)",
  },
};

const formatToday = () => new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

// Today's date, kept right for apps left open for days (refreshes after midnight
// and when the app comes back to the foreground)
function useTodayLabel() {
  const [label, setLabel] = useState(formatToday);
  useEffect(() => {
    let timer;
    const refresh = () => setLabel(formatToday());
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 5, 0);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, next - now);
    };
    const onVisible = () => document.visibilityState === "visible" && refresh();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return label;
}

const initialsOf = (name, fallback) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || fallback;

/**
 * @param groups      [{ heading, items: [{ id, text, short?, icon, badge? }] }]
 * @param activeId    id of the open page / tab
 * @param onSelect    (id) => void
 * @param title       top-bar title (empty on the overview, which shows the date instead)
 * @param profile     { name, subtitle } for the profile card / menu
 * @param roleLabel   e.g. "Tenant" (fallback subtitle)
 * @param onLogout    () => void
 * @param navLabel    accessible name for the sidebar navigation
 * @param bottomIds   ids shown in the phone bottom bar (default: every item, up to 5)
 * @param sidebarNote optional box under the links (e.g. a status message)
 * @param notifications show the bell (default true)
 * @param showBottomNav hide the bar when there's only one page (default: auto)
 */
export default function AppShell({
  groups,
  activeId,
  onSelect,
  title,
  profile = {},
  roleLabel = "",
  onLogout,
  navLabel = "Pages",
  bottomIds,
  sidebarNote = null,
  notifications = true,
  showBottomNav,
  sidebarTone = "light",
  children,
}) {
  const S = SIDEBAR[sidebarTone] || SIDEBAR.light;
  const todayLabel = useTodayLabel();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  const items = groups.flatMap((g) => g.items);
  const isOverview = !title;
  const bottomList = bottomIds ? items.filter((i) => bottomIds.includes(i.id)) : items.length > BOTTOM_MAX ? items.slice(0, BOTTOM_MAX - 1) : items;
  const needsMenu = bottomList.length < items.length;
  const bottomVisible = showBottomNav ?? items.length > 1;
  const activeBottom = bottomList.findIndex((i) => i.id === activeId);
  const bottomValue = activeBottom === -1 ? (needsMenu ? bottomList.length : false) : activeBottom;
  const name = profile.name || roleLabel || "Account";
  const subtitle = profile.subtitle || roleLabel;

  const pick = (id) => {
    onSelect(id);
    setDrawerOpen(false);
  };

  const sidebar = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: S.bg }}>
      {/* Brand header, same height as the top bar so the dividers line up */}
      <Toolbar sx={{ px: 2.5, height: BAR_H, minHeight: BAR_H }}>
        <Box component="img" src={S.logo} alt="KwartoKeeper" sx={{ display: "block", height: { xs: 34, md: 44 }, maxWidth: "100%", width: "auto", objectFit: "contain" }} />
      </Toolbar>
      <Divider sx={{ borderColor: S.border }} />

      <Box component="nav" aria-label={navLabel} sx={{ flexGrow: 1, overflowY: "auto", py: 1.5 }}>
        {groups.map((group, gIdx) => (
          <Box key={group.heading || gIdx} sx={{ mt: gIdx ? 1.5 : 0 }}>
            {group.heading && (
              <Typography sx={{ px: 3, pb: 0.5, fontFamily: HEAD, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: S.heading }}>
                {group.heading}
              </Typography>
            )}
            <List disablePadding>
              {group.items.map((item) => {
                const selected = item.id === activeId;
                return (
                  <ListItem key={item.id} disablePadding>
                    <ListItemButton
                      selected={selected}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => pick(item.id)}
                      sx={{
                        position: "relative",
                        mx: 1.5,
                        my: 0.25,
                        minHeight: 44,
                        borderRadius: "10px",
                        color: S.item,
                        "& .MuiListItemIcon-root": { color: S.item, minWidth: 38 },
                        "&:hover": { bgcolor: S.hoverBg, color: S.itemHover, "& .MuiListItemIcon-root": { color: S.itemHover } },
                        "&.Mui-selected": {
                          bgcolor: S.activeBg,
                          color: S.active,
                          "&:hover": { bgcolor: S.activeHoverBg },
                          "& .MuiListItemIcon-root": { color: S.activeIcon },
                          "&::before": { content: '""', position: "absolute", left: -12, top: 8, bottom: 8, width: 4, borderRadius: "0 4px 4px 0", bgcolor: "primary.main" },
                        },
                      }}
                    >
                      <ListItemIcon>
                        <Badge badgeContent={item.badge || 0} color="primary" max={99}>
                          {item.icon}
                        </Badge>
                      </ListItemIcon>
                      <ListItemText primary={item.text} slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 600, fontSize: 14.5 } } }} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
        {sidebarNote && <Box sx={{ mx: 1.5, mt: 2 }}>{sidebarNote}</Box>}
      </Box>

      {/* Who's signed in + log out */}
      <Divider sx={{ borderColor: S.border }} />
      <Box sx={{ p: 1.5, pb: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1, borderRadius: "12px", bgcolor: S.cardBg }}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: "primary.main", color: "#fff", fontFamily: HEAD, fontWeight: 800, fontSize: 14 }}>{initialsOf(name, "K")}</Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: S.name }}>
              {name}
            </Typography>
            <Typography variant="caption" noWrap sx={{ display: "block", color: S.subtitle }}>
              {subtitle}
            </Typography>
          </Box>
          <Tooltip title="Log out">
            <IconButton aria-label="Log out" onClick={onLogout} sx={{ color: S.logout, flexShrink: 0, "&:hover": { bgcolor: S.logoutHover } }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", width: "100%", bgcolor: (theme) => alpha(theme.palette.background.paper, 0.35) }}>
      {/* Desktop sidebar */}
      <Box sx={{ width: { md: SHELL_DRAWER_W }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: SHELL_DRAWER_W, borderRight: "1px solid", borderColor: S.border, bgcolor: S.bg } }}
        >
          {sidebar}
        </Drawer>
        {/* Phones: the same sidebar slides in from "Menu" when the bottom bar can't hold every page */}
        {needsMenu && (
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: `min(${SHELL_DRAWER_W}px, 86vw)`, borderRadius: "0 20px 20px 0", bgcolor: S.bg } }}
          >
            {sidebar}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            pt: "env(safe-area-inset-top, 0px)",
            bgcolor: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar sx={{ height: BAR_H, minHeight: BAR_H, gap: 1.5, px: { xs: 2, sm: 3 } }}>
            <Box component="img" src="/KwartoKeeper-Icon.png" alt="KwartoKeeper" sx={{ display: { xs: "block", md: "none" }, height: 30, width: 30, flexShrink: 0 }} />
            {title && (
              <Typography component="div" noWrap sx={{ minWidth: 0, fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.01em", fontSize: { xs: "1.1rem", md: "1.3rem" } }}>
                {title}
              </Typography>
            )}
            <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
              {isOverview && (
                <Typography variant="body2" noWrap sx={{ color: "text.secondary", fontWeight: 600, mr: 0.5, display: { xs: "none", sm: "block" } }}>
                  {todayLabel}
                </Typography>
              )}
              {notifications && <NotificationFeed />}
              {/* Phones: profile button (log out lives in here, away from the bell) */}
              <IconButton
                aria-label="Account menu"
                aria-haspopup="menu"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ display: { xs: "inline-flex", md: "none" }, p: 0.5 }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", color: "#fff", fontFamily: HEAD, fontWeight: 800, fontSize: 13 }}>{initialsOf(name, "K")}</Avatar>
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { mt: 1, minWidth: 220, borderRadius: "14px", bgcolor: "background.default" } } }}
              >
                <Box sx={{ px: 2, py: 1.25 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                    {name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {subtitle}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onLogout();
                  }}
                  sx={{ color: "error.main", fontWeight: 700, gap: 1.25, py: 1.25 }}
                >
                  <LogoutIcon fontSize="small" /> Log out
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            // Nothing on a page can make the whole screen scroll sideways; "clip" keeps sticky headers working
            overflowX: "clip",
            boxSizing: "border-box",
            p: { xs: 2, sm: 3 },
            pb: { xs: bottomVisible ? "calc(88px + env(safe-area-inset-bottom, 0px))" : 3, md: 3 },
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Phone bottom bar */}
      {bottomVisible && (
        <Paper
          elevation={0}
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            borderTop: "1px solid",
            borderColor: "divider",
            borderRadius: 0,
            bgcolor: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(10px)",
            pb: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <BottomNavigation
            showLabels
            value={bottomValue}
            onChange={(event, v) => (v === bottomList.length ? setDrawerOpen(true) : pick(bottomList[v].id))}
            sx={{
              bgcolor: "transparent",
              height: 66,
              "& .MuiBottomNavigationAction-root": { minWidth: 0, px: 0.5, color: "text.secondary", gap: 0.25 },
              "& .MuiBottomNavigationAction-label": { fontWeight: 600, fontSize: "0.72rem", whiteSpace: "nowrap", "&.Mui-selected": { fontSize: "0.72rem", fontWeight: 800 } },
              // pill behind the active icon
              "& .MuiBottomNavigationAction-root > .MuiSvgIcon-root, & .MuiBadge-root": { boxSizing: "content-box", px: 1.75, py: 0.25, borderRadius: 99, transition: "background-color .2s" },
              "& .Mui-selected > .MuiSvgIcon-root, & .Mui-selected .MuiBadge-root": { bgcolor: ACTIVE_BG },
              "& .Mui-selected": { color: "primary.main" },
            }}
          >
            {bottomList.map((item) => (
              <BottomNavigationAction
                key={item.id}
                label={item.short || item.text}
                icon={
                  <Badge badgeContent={item.badge || 0} color="error" max={99}>
                    {item.icon}
                  </Badge>
                }
              />
            ))}
            {needsMenu && <BottomNavigationAction label="Menu" icon={<MenuIcon />} />}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
