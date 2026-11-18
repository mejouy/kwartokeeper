// Edit a room's beds. Each bed is a single bed or a double deck (an upper
// and a lower bed space), and every bed space can have its own rate; blank
// uses the default rate for its kind. Saving hands back
// { monthlyRatePerBed, bedTypes, bedTypeRates, bedRates }.
// onSave may return a promise (the room map saves straight to the database);
// the dialog then waits and shows any error.
import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import {
  BED_TYPE_DOUBLE_DECK_LOWER,
  BED_TYPE_DOUBLE_DECK_UPPER,
  bedLabels,
  bedLetter,
  bedNameMap,
  bedRateOf,
  bedSpaceGroups,
  bedTypesForBunks,
  bunkPartnerOf,
  cleanBedRates,
  cleanBedTypeRates,
  cleanBedTypes,
  setBedUnitKind,
} from "../utils/bedRates";
import { BedUnit } from "./BedLayout";
import { t } from "../i18n";

const HEAD = '"Inter", sans-serif';
const peso = (n) => `₱${Math.round(Number(n) || 0).toLocaleString("en-PH")}`;
const money = (v) => String(v ?? "").replace(/[^\d.]/g, "");
const asText = (n) => (Number(n) > 0 ? String(n) : "");
const layoutText = (bunks, singles) => [
  bunks > 0 && (bunks === 1 ? t("1 double deck") : t("{n} double decks", { n: bunks })),
  singles > 0 && (singles === 1 ? t("1 single bed") : t("{n} single beds", { n: singles })),
].filter(Boolean).join(" · ");

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px" } };
const sectionSx = { p: { xs: 1.5, sm: 2 }, border: "1px solid", borderColor: "divider", borderRadius: "14px" };

function RateField({ label, value, onChange, placeholder, helper, highlight, ariaLabel }) {
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(money(e.target.value))}
      helperText={helper}
      slotProps={{
        inputLabel: { shrink: true },
        input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> },
        htmlInput: { inputMode: "decimal", ...(ariaLabel ? { "aria-label": ariaLabel } : {}) },
        formHelperText: { sx: { mx: 0.25, color: highlight ? "primary.main" : undefined, fontWeight: highlight ? 700 : 400 } },
      }}
      sx={fieldSx}
    />
  );
}

export default function BedRatesDialog({ room, onClose, onSave, saveLabel = t("Done") }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  const capacity = Number(room?.capacity) || 0;
  const beds = bedLabels(capacity);

  const [baseRate, setBaseRate] = useState(asText(room?.monthlyRatePerBed));
  const [bedTypes, setBedTypes] = useState(() => cleanBedTypes(room?.bedTypes, capacity));
  const [upperRate, setUpperRate] = useState(asText(room?.bedTypeRates?.[BED_TYPE_DOUBLE_DECK_UPPER]));
  const [lowerRate, setLowerRate] = useState(asText(room?.bedTypeRates?.[BED_TYPE_DOUBLE_DECK_LOWER]));
  const [ownRates, setOwnRates] = useState(() => Object.fromEntries(beds.map((b) => [b, asText(room?.bedRates?.[b])])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const base = Number(baseRate) || 0;
  const draftRoom = useMemo(() => ({
    capacity,
    monthlyRatePerBed: base,
    bedTypes,
    bedTypeRates: { [BED_TYPE_DOUBLE_DECK_UPPER]: Number(upperRate) || 0, [BED_TYPE_DOUBLE_DECK_LOWER]: Number(lowerRate) || 0 },
    bedRates: Object.fromEntries(Object.entries(ownRates).map(([b, v]) => [b, Number(v) || 0])),
  }), [capacity, base, bedTypes, upperRate, lowerRate, ownRates]);

  const units = bedSpaceGroups(draftRoom, capacity);
  const names = bedNameMap(draftRoom, capacity);
  const bunks = units.filter((u) => u.kind === "doubleDeck").length;
  const singles = capacity - bunks * 2;
  const maxBunks = Math.floor(capacity / 2);
  // A bed space's rate when it has none of its own: the room rate, or its bunk level's
  const usualRate = (bed) => bedRateOf({ ...draftRoom, bedRates: {} }, bed);
  const hasOwn = (bed) => Number(ownRates[bed]) > 0 && Number(ownRates[bed]) !== usualRate(bed);
  const fullTotal = beds.reduce((sum, b) => sum + bedRateOf(draftRoom, b), 0);
  const rates = beds.map((b) => bedRateOf(draftRoom, b)).filter((r) => r > 0);
  const range = rates.length ? [Math.min(...rates), Math.max(...rates)] : [0, 0];

  const switchKind = (bedId, kind) => {
    const next = setBedUnitKind(draftRoom, capacity, bedId, kind);
    if (next) setBedTypes(next);
  };
  const setOwn = (bed) => (v) => setOwnRates((r) => ({ ...r, [bed]: v }));

  const save = async () => {
    const cleanTypes = cleanBedTypes(bedTypes, capacity);
    const bedTypeRates = bunks ? cleanBedTypeRates(draftRoom.bedTypeRates, base) : {};
    const result = {
      monthlyRatePerBed: base,
      bedTypes: cleanTypes,
      bedTypeRates,
      bedRates: cleanBedRates(draftRoom.bedRates, capacity, base, cleanTypes, bedTypeRates),
    };
    setError("");
    setSaving(true);
    try {
      await onSave(result);
      onClose();
    } catch (err) {
      console.error("Couldn't save beds:", err);
      setError(t("Couldn't save the beds. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: fullScreen ? {} : { borderRadius: "20px" } } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "flex-start", gap: 1, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 900, fontSize: "1.2rem" }} noWrap>
            {t("Beds · {room}", { room: room?.roomName || t("Room") })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("{n} bed spaces", { n: capacity })}
            {capacity > 0 && ` · ${layoutText(bunks, singles)}`}
          </Typography>
        </Box>
        <IconButton aria-label={t("Close")} onClick={onClose} disabled={saving} sx={{ mt: -0.5, mr: -1 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {capacity === 0 ? (
          <Typography variant="body2" color="text.secondary">{t("Add beds to this room first.")}</Typography>
        ) : (
          <>
            {/* DEFAULT RATES */}
            <Box sx={sectionSx}>
              <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "0.95rem" }}>{t("Default rates")}</Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
                {t("Every bed uses these unless you give it its own rate below.")}
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: bunks ? "repeat(3, minmax(0, 1fr))" : "minmax(0, 1fr)" }, gap: 1.5 }}>
                <RateField label={bunks && !singles ? t("Room rate") : t("Single bed")} value={baseRate} onChange={setBaseRate} placeholder="0" />
                {bunks > 0 && (
                  <>
                    <RateField label={t("Upper bunk")} value={upperRate} onChange={setUpperRate} placeholder={String(base)} />
                    <RateField label={t("Lower bunk")} value={lowerRate} onChange={setLowerRate} placeholder={String(base)} />
                  </>
                )}
              </Box>
            </Box>

            {/* BEDS */}
            <Box sx={sectionSx}>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
                <Box sx={{ minWidth: 0, flex: "1 1 220px" }}>
                  <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "0.95rem" }}>{t("Beds")}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {t("Set each bed as single or double deck. A double deck uses 2 bed spaces.")}
                  </Typography>
                </Box>
                {maxBunks > 0 && (
                  <Box sx={{ display: "flex", gap: 0.5, ml: -0.75 }}>
                    <Button size="small" onClick={() => setBedTypes({})} disabled={bunks === 0} sx={{ fontWeight: 700, textTransform: "none" }}>
                      {t("All single")}
                    </Button>
                    <Button size="small" onClick={() => setBedTypes(bedTypesForBunks(capacity, maxBunks))} disabled={bunks === maxBunks} sx={{ fontWeight: 700, textTransform: "none" }}>
                      {t("All double deck")}
                    </Button>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {units.map((unit, unitIndex) => {
                  const isBunk = unit.kind === "doubleDeck";
                  const first = unit.spaces[0].id;
                  const canPair = isBunk || Boolean(bunkPartnerOf(draftRoom, capacity, first));
                  const title = t("Bed {letter}", { letter: bedLetter(unitIndex) });
                  const subtitle = isBunk
                    ? t("Double deck · upper and lower")
                    : canPair
                      ? t("Single bed")
                      : t("Single bed · no single bed next to it to pair with");
                  return (
                    <Box
                      key={unit.spaces.map((s) => s.id).join("-")}
                      sx={{
                        p: { xs: 1.25, sm: 1.5 },
                        borderRadius: "12px",
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: (th) => (isBunk ? alpha(th.palette.primary.main, 0.035) : "transparent"),
                      }}
                    >
                      <Box sx={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr)", alignItems: "center", gap: 1.25 }}>
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <BedUnit kind={unit.kind} size="md" levels={unit.spaces.map((s) => ({ state: "free", title: names[s.id] }))} />
                        </Box>
                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1, minWidth: 0 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>{title}</Typography>
                            <Typography variant="caption" color="text.secondary" component="div">{subtitle}</Typography>
                          </Box>
                          <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={isBunk ? "doubleDeck" : "single"}
                            onChange={(e, kind) => kind && switchKind(first, kind)}
                            aria-label={t("Bed type for {bed}", { bed: title })}
                            sx={{
                              "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.25, py: 0.4, lineHeight: 1.4 },
                              "& .MuiToggleButton-root.Mui-selected": { bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } },
                            }}
                          >
                            <ToggleButton value="single">{t("Single")}</ToggleButton>
                            <ToggleButton value="doubleDeck" disabled={!canPair}>{t("Double deck")}</ToggleButton>
                          </ToggleButtonGroup>
                        </Box>
                      </Box>

                      {/* This bed's own rates */}
                      <Box sx={{ display: "grid", gridTemplateColumns: isBunk ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 1.25, mt: 1.5, ml: { sm: "56px" } }}>
                        {(isBunk ? [[unit.spaces[0], names[unit.spaces[0].id]], [unit.spaces[1], names[unit.spaces[1].id]]] : [[unit.spaces[0], t("Rate")]]).map(([space, label]) => (
                          <RateField
                            key={space.id}
                            label={label}
                            ariaLabel={t("Rate for {bed}", { bed: names[space.id] })}
                            value={ownRates[space.id]}
                            onChange={setOwn(space.id)}
                            placeholder={String(usualRate(space.id))}
                            highlight={hasOwn(space.id)}
                            helper={hasOwn(space.id) ? t("Own rate") : t("Default · {rate}", { rate: peso(usualRate(space.id)) })}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Typography variant="caption" color="text.secondary">
              {t("New tenants are charged their bed's rate. Current tenants keep their rent.")}
            </Typography>
            {error && <Alert severity="error" sx={{ borderRadius: "12px" }}>{error}</Alert>}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 1, borderTop: "1px solid", borderColor: "divider", pb: fullScreen ? "calc(12px + env(safe-area-inset-bottom, 0px))" : 1.5 }}>
        <Box sx={{ mr: "auto", minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.2 }}>
            {t("When full")}
          </Typography>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 900, lineHeight: 1.2 }} noWrap>
            {peso(fullTotal)}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {" "}{t("/ month")}
              {range[0] !== range[1] && (
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{` · ${peso(range[0])}–${peso(range[1])}`}</Box>
              )}
            </Typography>
          </Typography>
        </Box>
        <Button onClick={onClose} disabled={saving} sx={{ fontWeight: 700 }}>
          {t("Cancel")}
        </Button>
        <Button variant="contained" disableElevation onClick={save} disabled={saving || capacity === 0} sx={{ fontWeight: 700, borderRadius: "10px" }}>
          {saving ? t("Saving…") : saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
