// Shared building blocks for the property setup steps, so every step
// looks and behaves the same: white cards on the cream page, a step header,
// tap-to-pick tiles and +/- counters.
import { Box, Typography, IconButton, Button, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

const HEAD = '"Inter", sans-serif';

export function StepHeader({ step, total, title, subtitle }) {
  return (
    <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "primary.main" }}>
        Step {step} of {total}
      </Typography>
      <Typography component="h1" sx={{ fontFamily: HEAD, fontWeight: 900, letterSpacing: "-0.02em", fontSize: { xs: "1.55rem", sm: "1.9rem" }, lineHeight: 1.2, mt: 0.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 560 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

// A titled white card. `optional` adds a small tag next to the title.
export function FormCard({ icon: Icon, title, description, optional, action, children, error }) {
  return (
    <Box
      component="section"
      sx={{
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: error ? "error.main" : "divider",
        borderRadius: "18px",
        p: { xs: 2, sm: 3 },
        minWidth: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2.25 }}>
        {Icon && (
          <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
            <Icon sx={{ fontSize: 20 }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.3 }}>{title}</Typography>
            {optional && (
              <Box component="span" sx={{ px: 0.85, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: 11.5, fontWeight: 700, color: "text.secondary", bgcolor: (t) => alpha(t.palette.text.primary, 0.06) }}>
                Optional
              </Box>
            )}
          </Box>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.5 }}>
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}

// A tappable option (property type, naming pattern, layout mode...)
export function ChoiceTile({ active, onClick, icon: Icon, title, hint, sx }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      sx={{
        minWidth: 0,
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        p: 1.5,
        textAlign: "left",
        font: "inherit",
        cursor: "pointer",
        borderRadius: "14px",
        border: "1.5px solid",
        borderColor: active ? "primary.main" : "divider",
        bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.06) : "transparent"),
        color: "text.primary",
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: active ? "primary.main" : (t) => alpha(t.palette.text.primary, 0.3) },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
        ...sx,
      }}
    >
      {Icon && (
        <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: active ? "primary.main" : (t) => alpha(t.palette.text.primary, 0.06), color: active ? "#fff" : "text.secondary", transition: "background-color .15s" }}>
          <Icon sx={{ fontSize: 19 }} />
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.3 }}>{title}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4, mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// − value + with large touch targets
export function Counter({ value, onChange, min = 1, max = 999, label, size = "md" }) {
  const big = size === "lg";
  const btn = {
    width: big ? 48 : 40,
    height: big ? 48 : 40,
    borderRadius: "12px",
    border: "1px solid",
    borderColor: "divider",
    color: "text.primary",
    "&:hover": { borderColor: "primary.main", color: "primary.main", bgcolor: "transparent" },
    "&.Mui-disabled": { borderColor: "divider", opacity: 0.45 },
  };
  return (
    <Box role="group" aria-label={label} sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <IconButton aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} sx={btn}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography aria-live="polite" sx={{ minWidth: big ? 56 : 40, textAlign: "center", fontFamily: HEAD, fontWeight: 900, fontSize: big ? "1.6rem" : "1.15rem", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      <IconButton aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} sx={btn}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// Sticky bottom bar: Back on the left, the main action on the right
export function WizardFooter({ onBack, backLabel = "Back", primaryLabel, onPrimary, busy, disabled, hint, primaryIcon }) {
  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        zIndex: 5,
        mt: 3,
        mx: { xs: -2, sm: 0 },
        px: { xs: 2, sm: 0 },
        pt: 1.5,
        pb: "calc(14px + env(safe-area-inset-bottom, 0px))",
        bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
        backdropFilter: "blur(10px)",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      {hint && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1, display: { sm: "none" } }}>
          {hint}
        </Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Button variant="outlined" color="inherit" onClick={onBack} disabled={busy} sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 48, px: { xs: 2, sm: 3 }, borderColor: "divider", bgcolor: "background.default" }}>
          {backLabel}
        </Button>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0, display: { xs: "none", sm: "block" }, textAlign: "right" }}>
            {hint}
          </Typography>
        )}
        <Button
          variant="contained"
          disableElevation
          onClick={onPrimary}
          disabled={busy || disabled}
          endIcon={busy ? <CircularProgress size={18} color="inherit" /> : primaryIcon}
          sx={{ fontWeight: 800, borderRadius: "10px", minHeight: 48, px: 3, flex: { xs: 1, sm: hint ? "none" : "0 0 auto" }, ml: { sm: hint ? 0 : "auto" }, boxShadow: "0 10px 22px -14px rgba(255,69,0,.9)" }}
        >
          {primaryLabel}
        </Button>
      </Box>
    </Box>
  );
}
