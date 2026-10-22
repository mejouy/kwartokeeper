// Shared pieces for the admin pages, in the same style as the owner pages:
// a light header card with a soft orange glow and stat tiles, white panels on
// the cream page, small status pills and tap-to-filter pills.
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const panelBase = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg, minWidth: 0 };

/**
 * Page header: a line of context and the main action on top, then stat tiles.
 * tiles: [{ label, value, sub?, icon, tone?, onClick? }]
 */
export function HeaderCard({ eyebrow, title, description, action, tiles = [], children }) {
  return (
    <Box component="section" sx={{ ...panelBase, position: "relative", overflow: "hidden", borderRadius: R.xl, p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
      <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />
      <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 2 }, mb: tiles.length || children ? { xs: 2, sm: 2.5 } : 0 }}>
        <Box sx={{ minWidth: 0 }}>
          {eyebrow}
          {title && (
            <Typography component="h1" sx={{ fontFamily: HEAD, fontWeight: 900, letterSpacing: "-0.02em", fontSize: { xs: "1.35rem", sm: "1.75rem" }, lineHeight: 1.2, overflowWrap: "anywhere" }}>
              {title}
            </Typography>
          )}
          {description && (
            <Typography color="text.secondary" sx={{ mt: title ? 0.5 : 0, fontSize: { xs: 14, sm: 15 } }}>
              {description}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0, display: "flex", gap: 1, flexWrap: "wrap", "& > *": { flex: { xs: 1, sm: "none" } } }}>{action}</Box>}
      </Box>
      {children}
      {tiles.length > 0 && (
        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${Math.min(tiles.length, 5)}, minmax(0, 1fr))` }, gap: { xs: 1, sm: 1.5 }, ...(tiles.length % 2 === 1 ? { "& > :last-of-type": { gridColumn: { xs: "1 / -1", md: "auto" } } } : {}) }}>
          {tiles.map((t) => {
            const inner = (
              <>
                <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "#fff", color: t.tone ? `${t.tone}.main` : "primary.main", "& svg": { fontSize: { xs: 18, sm: 20 } } }}>
                  {t.icon}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                    {t.label}
                  </Typography>
                  <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.2, color: t.tone ? `${t.tone}.dark` : "text.primary" }}>
                    {t.value}
                  </Typography>
                  {t.sub && (
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {t.sub}
                    </Typography>
                  )}
                </Box>
              </>
            );
            const sx = { minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, p: { xs: 1.25, sm: 1.75 }, borderRadius: R.md, textAlign: "left", border: 0, font: "inherit", color: "inherit", bgcolor: (th) => alpha(th.palette.background.paper, 0.55) };
            return t.onClick ? (
              <Box key={t.label} component="button" type="button" onClick={t.onClick} sx={{ ...sx, cursor: "pointer", "&:hover": { bgcolor: (th) => alpha(th.palette.background.paper, 0.9) } }}>
                {inner}
              </Box>
            ) : (
              <Box key={t.label} sx={sx}>
                {inner}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export function Panel({ title, icon, action, children, sx, id }) {
  return (
    <Box id={id} sx={{ ...panelBase, p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", ...sx }}>
      {(title || action) && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
            {icon && (
              <Box sx={{ width: 36, height: 36, borderRadius: R.sm, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main", "& svg": { fontSize: 20 } }}>
                {icon}
              </Box>
            )}
            <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.05rem" }}>
              {title}
            </Typography>
          </Box>
          {action}
        </Box>
      )}
      {children}
    </Box>
  );
}

export function Pill({ label, tone = "default", icon, sx }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        height: 24,
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        "& svg": { fontSize: 15 },
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.06) : alpha(t.palette[tone].main, 0.12)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
        ...sx,
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

/** options: [{ id, label, count? }] */
export function FilterPills({ options, value, onChange, sx }) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, ...sx }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Box
            key={o.id}
            component="button"
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              flexShrink: 0,
              height: 38,
              px: 1.5,
              borderRadius: 99,
              font: "inherit",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              borderColor: on ? "text.primary" : "divider",
              bgcolor: on ? "text.primary" : "background.default",
              color: on ? "background.default" : "text.secondary",
            }}
          >
            {o.label}
            {typeof o.count === "number" && (
              <Box component="span" sx={{ opacity: 0.65, fontWeight: 600 }}>
                {o.count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
