// The one short message the app shows after an action ("Changes saved.",
// "Couldn't save…"). Every page uses this, so they all look and behave alike:
//  - KwartoKeeper's dark ink card with a coloured icon for the result
//    (green saved · red error · amber warning · blue info)
//  - bottom centre, lifted above the phone's bottom bar (pages with a
//    floating button pass their own `bottom`)
//  - success goes away quickly, errors stay longer so they can be read;
//    hovering or focusing keeps it open; it can always be closed
//  - an optional action (Undo, Retry) in the brand orange
import { Box, IconButton, Slide, Snackbar, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { t } from "../i18n";

const INK = "#202020";
const LOOK = {
  success: { icon: CheckRoundedIcon, color: "#3fb950", label: "Done" },
  error: { icon: PriorityHighRoundedIcon, color: "#ff6b5e", label: "Problem" },
  warning: { icon: WarningAmberRoundedIcon, color: "#f5b942", label: "Heads up" },
  info: { icon: InfoOutlinedIcon, color: "#7cb7ff", label: "Note" },
};
const DURATION = { success: 3500, info: 4500, warning: 6000, error: 7000 };
// Clears the phone's bottom navigation bar (and the iPhone home bar)
export const TOAST_BOTTOM = "calc(80px + env(safe-area-inset-bottom, 0px))";

const SlideUp = (props) => <Slide {...props} direction="up" />;

/**
 * open, message, severity ("success" | "error" | "warning" | "info"), onClose
 * action: { label, onClick } shown as a button (the toast stays a bit longer)
 * bottom: phone offset from the bottom edge (CSS value)
 */
export default function Toast({ open, message, severity = "success", onClose, action, bottom = TOAST_BOTTOM, duration }) {
  const look = LOOK[severity] || LOOK.success;
  const Icon = look.icon;
  const close = (e, reason) => {
    if (reason === "clickaway") return; // a tap elsewhere shouldn't hide an error before it's read
    onClose?.();
  };
  return (
    <Snackbar
      open={Boolean(open && message)}
      autoHideDuration={duration ?? (action ? Math.max(DURATION[severity] || 4000, 6000) : DURATION[severity] || 4000)}
      onClose={close}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      slots={{ transition: SlideUp }}
      sx={{ bottom: { xs: `${bottom} !important`, sm: "24px !important" }, left: { xs: 12, sm: "50%" }, right: { xs: 12, sm: "auto" } }}
    >
      <Box
        role={severity === "error" ? "alert" : "status"}
        aria-live={severity === "error" ? "assertive" : "polite"}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          width: { xs: "100%", sm: "auto" },
          minWidth: { sm: 320 },
          maxWidth: { sm: 520 },
          py: 1,
          pl: 1.25,
          pr: 0.75,
          borderRadius: "14px",
          bgcolor: INK,
          color: "#fff",
          boxShadow: "0 16px 36px -14px rgba(0,0,0,.55)",
          borderLeft: `4px solid ${look.color}`,
        }}
      >
        <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: `${look.color}26`, color: look.color }}>
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600, lineHeight: 1.4, py: 0.5, overflowWrap: "anywhere" }}>
          <Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t(look.label)}: </Box>
          {message}
        </Typography>
        {action && (
          <Box
            component="button"
            type="button"
            onClick={() => {
              action.onClick?.();
              onClose?.();
            }}
            sx={{ flexShrink: 0, border: 0, bgcolor: "transparent", color: "#ff7a45", font: "inherit", fontWeight: 800, fontSize: 14, px: 1.25, minHeight: 36, borderRadius: "8px", cursor: "pointer", "&:hover": { bgcolor: "rgba(255,255,255,.08)" }, "&:focus-visible": { outline: "2px solid #ff7a45" } }}
          >
            {action.label}
          </Box>
        )}
        <IconButton size="small" aria-label={t("Close")} onClick={() => onClose?.()} sx={{ color: "rgba(255,255,255,.7)", flexShrink: 0, "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,.08)" } }}>
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Snackbar>
  );
}
