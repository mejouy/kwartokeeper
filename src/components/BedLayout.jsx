// Beds drawn from the side, used by the room map, the room panel and the bed
// editor. A single bed is one mattress on short legs; a double deck is two
// mattresses stacked in one frame (upper on top), so owners can tell them
// apart at a glance. Each mattress is one bed space: orange when taken,
// outlined when free, grey when the room can't be rented.
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { bedSpaceGroups } from "../utils/bedRates";

export const BED_TAKEN = "#ff4500";

const SIZES = {
  xs: { w: 16, cell: 6, gap: 2, post: 2, leg: 2, pillow: 4, radius: 2 },
  sm: { w: 22, cell: 8, gap: 3, post: 2, leg: 3, pillow: 5, radius: 2 },
  md: { w: 40, cell: 13, gap: 5, post: 3, leg: 4, pillow: 9, radius: 3 },
  lg: { w: 56, cell: 18, gap: 7, post: 4, leg: 5, pillow: 13, radius: 4 },
};

/** One mattress (one bed space). state: "taken" | "free" | "off" | "selected" */
export function Mattress({ state = "free", size = "sm", title }) {
  const s = SIZES[size] || SIZES.sm;
  const taken = state === "taken";
  const selected = state === "selected";
  const off = state === "off";
  return (
    <Box
      title={title}
      sx={{
        position: "relative",
        height: s.cell,
        borderRadius: `${s.radius}px`,
        boxSizing: "border-box",
        bgcolor: taken
          ? BED_TAKEN
          : selected
            ? (t) => alpha(t.palette.primary.main, 0.18)
            : off
              ? (t) => alpha(t.palette.text.primary, 0.12)
              : "background.paper",
        border: taken || off ? "none" : "1.5px solid",
        borderColor: selected ? "primary.main" : (t) => alpha(t.palette.text.primary, 0.32),
        overflow: "hidden",
      }}
    >
      {/* pillow, so it reads as a bed and not a box */}
      <Box
        sx={{
          position: "absolute",
          left: Math.max(1, s.radius - 1),
          top: "50%",
          transform: "translateY(-50%)",
          width: s.pillow,
          height: Math.max(2, s.cell - (taken || off ? 4 : 6)),
          borderRadius: `${Math.max(1, s.radius - 1)}px`,
          bgcolor: taken ? "rgba(255,255,255,.7)" : (t) => alpha(t.palette.text.primary, 0.16),
        }}
      />
    </Box>
  );
}

/**
 * One bed unit. kind: "single" | "doubleDeck" | "unpaired".
 * levels: [{ state, title }], top to bottom (upper first for a double deck).
 */
export function BedUnit({ kind = "single", levels = [], size = "sm" }) {
  const s = SIZES[size] || SIZES.sm;
  const isBunk = kind === "doubleDeck";
  const rail = (t) => alpha(t.palette.text.primary, 0.18);
  return (
    <Box
      aria-hidden
      sx={{
        width: s.w,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: `${s.gap}px`,
        boxSizing: "border-box",
        px: "1px",
        pt: isBunk ? `${s.leg}px` : "1px",
        pb: `${s.leg}px`,
        // the posts of the frame, running down to the floor as legs
        borderLeft: `${s.post}px solid`,
        borderRight: `${s.post}px solid`,
        borderColor: (t) => alpha(t.palette.text.primary, isBunk ? 0.5 : 0.35),
        borderRadius: `${s.radius}px ${s.radius}px 0 0`,
        // the rail between the upper and lower bunk
        ...(isBunk && {
          backgroundImage: (t) => `linear-gradient(${rail(t)}, ${rail(t)})`,
          backgroundSize: "100% 1px",
          backgroundRepeat: "no-repeat",
          backgroundPosition: `0 ${s.leg + s.cell + s.gap / 2}px`,
        }),
      }}
    >
      {levels.map((level, i) => (
        <Mattress key={i} size={size} state={level.state} title={level.title} />
      ))}
    </Box>
  );
}

/** A preview of a room's beds from its bed types (no tenants). */
export function BedLayoutPreview({ room, capacity, size = "md" }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 1 }}>
      {bedSpaceGroups(room, capacity).map((unit) => (
        <BedUnit
          key={unit.spaces.map((space) => space.id).join("-")}
          kind={unit.kind}
          size={size}
          levels={unit.spaces.map((space) => ({ state: "free", title: space.id }))}
        />
      ))}
    </Box>
  );
}
