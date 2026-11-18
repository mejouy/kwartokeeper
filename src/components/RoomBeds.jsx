// A room's beds, shared by the owner's room map (PropertyProfile) and the
// caretaker's Rooms tab, so both show the same thing:
//  - RoomBedStrip: the little bed drawings on a room tile (single beds and
//    double decks, orange when taken)
//  - RoomBedList: every bed with who sleeps there and its rate, for the room
//    panel (a double deck is one card with its upper and lower bed)
//  - RoomRateList: every rate the room charges
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { BedUnit } from "./BedLayout";
import { bedLetter, bedNameMap, bedRateOf, roomBedUnits, roomRateLines } from "../utils/bedRates";
import { t } from "../i18n";

const MAX_BED_SPACES = 12; // a very big room shows "+N" instead of a wall of beds
const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;
const nameOf = (tenant) => tenant?.name || tenant?.fullName || tenant?.email || t("Tenant");
const capacityOf = (room) => Number(room?.capacity || room?.beds || room?.totalBeds || 0);

/** The bed drawings on a room tile. */
export function RoomBedStrip({ room, roomTenants = [], maintenance = false }) {
  const capacity = capacityOf(room);
  if (!capacity) return null;
  const shown = Math.min(capacity, MAX_BED_SPACES);
  const { units } = roomBedUnits(room, shown, roomTenants, { fillUnplaced: true });
  const names = bedNameMap(room, capacity);
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, width: "100%", minWidth: 0 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", columnGap: "4px", rowGap: "6px", minWidth: 0 }}>
        {units.map((unit) => (
          <BedUnit
            key={unit.spaces.map((space) => space.id).join("-")}
            kind={unit.kind}
            size="sm"
            levels={unit.spaces.map((space) => ({
              state: maintenance ? "off" : space.tenant ? "taken" : "free",
              title: `${names[space.id] || space.id} · ${space.tenant ? nameOf(space.tenant) : maintenance ? t("Unavailable") : t("Free bed")}`,
            }))}
          />
        ))}
      </Box>
      {capacity > MAX_BED_SPACES && (
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", lineHeight: 1 }}>
          +{capacity - MAX_BED_SPACES}
        </Typography>
      )}
    </Box>
  );
}

/** The legend for RoomBedStrip. */
export function RoomBedLegend({ extra = [] }) {
  const items = [
    [t("Bed taken"), <BedUnit key="a" size="xs" levels={[{ state: "taken" }]} />],
    [t("Bed free"), <BedUnit key="b" size="xs" levels={[{ state: "free" }]} />],
    [t("Double deck"), <BedUnit key="c" size="xs" kind="doubleDeck" levels={[{ state: "free" }, { state: "taken" }]} />],
    ...extra,
  ];
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", columnGap: 2.25, rowGap: 1 }}>
      {items.map(([label, swatch]) => (
        <Box key={label} sx={{ display: "flex", alignItems: "flex-end", gap: 0.75 }}>
          {swatch}
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1 }}>
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function Line({ tenant, onOpen, children }) {
  const clickable = Boolean(tenant && onOpen);
  return (
    <Box
      component={clickable ? "button" : "div"}
      type={clickable ? "button" : undefined}
      onClick={clickable ? () => onOpen(tenant) : undefined}
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 1,
        width: "100%",
        textAlign: "left",
        px: 1,
        py: 0.75,
        fontFamily: "inherit",
        color: "inherit",
        bgcolor: "transparent",
        border: "none",
        borderRadius: "8px",
        cursor: clickable ? "pointer" : "default",
        "&:hover": clickable ? { bgcolor: "action.hover" } : {},
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Every bed of a room with who sleeps there and its rate. `onOpenTenant`
 * makes tenant rows clickable; `moveOutOf(tenant)` adds their move-out date.
 */
export function RoomBedList({ room, roomTenants = [], maintenance = false, onOpenTenant, moveOutOf }) {
  const capacity = capacityOf(room);
  const { units, unplaced } = roomBedUnits(room, capacity, roomTenants);
  const names = bedNameMap(room, capacity);
  const showChevron = Boolean(onOpenTenant);

  const spaceRow = (space) => {
    const rate = bedRateOf(room, space.id);
    const tenant = space.tenant;
    const moveOut = tenant && moveOutOf ? moveOutOf(tenant) : null;
    return (
      <Line key={space.id} tenant={tenant} onOpen={onOpenTenant}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {names[space.id] || space.id}
            {moveOut && (
              <Box component="span" sx={{ fontWeight: 500 }}>
                {" "}· {t("out")} {moveOut}
              </Box>
            )}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: tenant ? 700 : 500, color: tenant ? "text.primary" : maintenance ? "text.disabled" : "success.main" }}>
            {tenant ? nameOf(tenant) : maintenance ? t("Unavailable") : t("Free")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: Number(room?.bedRates?.[space.id]) > 0 ? "primary.main" : "text.secondary" }}>
            {rate ? peso(rate) : "—"}
          </Typography>
          {showChevron && <ChevronRightIcon aria-hidden sx={{ fontSize: 18, color: "text.disabled", visibility: tenant ? "visible" : "hidden" }} />}
        </Box>
      </Line>
    );
  };

  if (!capacity) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: "10px" }}>
        {t("This room has no beds yet.")}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {units.map((unit, unitIndex) => (
        <Box
          key={unit.spaces.map((space) => space.id).join("-")}
          sx={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr)", alignItems: "center", gap: 1, p: 0.75, pl: 1.25, border: "1px solid", borderColor: "divider", borderRadius: "10px" }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
            <BedUnit kind={unit.kind} size="md" levels={unit.spaces.map((space) => ({ state: maintenance ? "off" : space.tenant ? "taken" : "free" }))} />
            <Typography sx={{ fontSize: 10, fontWeight: 800, color: "text.secondary", lineHeight: 1, textAlign: "center" }}>
              {t("Bed {letter}", { letter: bedLetter(unitIndex) })}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>{unit.spaces.map((space) => spaceRow(space))}</Box>
        </Box>
      ))}

      {unplaced.length > 0 && (
        <Box sx={{ mt: 0.5, p: 1, border: "1px dashed", borderColor: "divider", borderRadius: "10px" }}>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ fontWeight: 700, px: 1, pb: 0.25 }}>
            {t("No bed assigned yet")}
          </Typography>
          {unplaced.map((tenant) => (
            <Line key={tenant.uid || tenant.id} tenant={tenant} onOpen={onOpenTenant}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{nameOf(tenant)}</Typography>
              {showChevron ? <ChevronRightIcon sx={{ fontSize: 18, color: "text.disabled" }} /> : <span />}
            </Line>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** Every rate the room charges: each kind of bed, then beds with their own rate. */
export function RoomRateList({ room, sx }) {
  const capacity = capacityOf(room);
  if (!capacity) return null;
  const names = bedNameMap(room, capacity);
  return (
    <Box sx={{ p: 1.25, borderRadius: "10px", bgcolor: (th) => alpha(th.palette.background.paper, 0.45), minWidth: 0, ...sx }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
        {t("Monthly rates")}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 1.5, rowGap: 0.4 }}>
        {roomRateLines(room, capacity).map((line) => {
          const label = line.kind === "own"
            ? `${names[line.bed] || line.bed} · ${t("own rate")}`
            : `${{ single: t("Single bed"), upper: t("Upper bunk"), lower: t("Lower bunk") }[line.kind]}${line.count > 1 ? ` × ${line.count}` : ""}`;
          return (
            <Box key={line.key} sx={{ display: "contents" }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: line.kind === "own" ? "primary.main" : "text.primary" }}>{label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {line.rate ? peso(line.rate) : "—"}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
