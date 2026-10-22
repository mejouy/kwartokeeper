import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, TextField, MenuItem, Button, IconButton, Alert, InputAdornment, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import CheckIcon from "@mui/icons-material/Check";

import { buildUniformRooms, buildPerFloorRooms, computeSummary } from "../../../utils/roomGenerator";
import { saveProperty } from "../../services/propertyService";
import { useAuth } from "../../../context/AuthContext";
import { StepHeader, FormCard, ChoiceTile, Counter, WizardFooter } from "./wizardUi";

const HEAD = '"Inter", sans-serif';
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px" } };
const CAPACITY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const ROOM_TYPES = ["Bedspace", "Studio-type", "Solo / Single", "Private / Shared", "Custom"];
const MAX_ROOMS_PER_FLOOR = 99; // "floor" numbering (101...199) runs out after 99
const MAX_ALPHA_FLOORS = 26; // A...Z
const PREVIEW_PER_ROW = 24;

const NAMING = [
  { value: "floor", title: "By floor", hint: (f) => (f > 1 ? "101, 102 … 201, 202" : "101, 102, 103") },
  { value: "alpha", title: "Letters", hint: (f) => (f > 1 ? "A1, A2 … B1, B2" : "A1, A2, A3") },
  { value: "sequential", title: "Plain numbers", hint: () => "1, 2, 3, 4 …" },
];

const peso = (n) => `₱${Math.round(Number(n) || 0).toLocaleString("en-PH")}`;
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const newGroup = (from) => ({
  id: uid(),
  roomType: from?.roomType || "Bedspace",
  customRoomType: from?.customRoomType || "",
  numberOfRooms: from?.numberOfRooms || 4,
  capacityPerRoom: from?.capacityPerRoom || 4,
  monthlyRate: from?.monthlyRate ?? 2500,
});
const typeName = (g) => (g.roomType === "Custom" ? g.customRoomType?.trim() || "Custom room" : g.roomType);
const rateInput = (v) => (v === "" ? "" : Math.min(1000000, Math.max(0, parseInt(String(v).replace(/\D/g, ""), 10) || 0)));

// One kind of room on a floor: type, how many, beds each, rate per bed
function GroupEditor({ group, onChange, onRemove, canRemove, errors }) {
  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "14px", border: "1px solid", borderColor: errors ? "error.main" : "divider", bgcolor: (t) => alpha(t.palette.background.paper, 0.3) }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1.3fr) minmax(0, 1fr)" }, gap: 1.5, alignItems: "start" }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            select
            fullWidth
            label="Room type"
            value={group.roomType}
            onChange={(e) => onChange({ roomType: e.target.value, ...(e.target.value === "Solo / Single" ? { capacityPerRoom: 1 } : {}), ...(e.target.value !== "Custom" ? { customRoomType: "" } : {}) })}
            sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "background.default" } }}
          >
            {ROOM_TYPES.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          {canRemove && (
            <Tooltip title="Remove this room type">
              <IconButton onClick={onRemove} aria-label="Remove this room type" sx={{ mt: 1, color: "text.secondary", "&:hover": { color: "error.main" } }}>
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {group.roomType === "Custom" ? (
          <TextField
            fullWidth
            label="Name this room type"
            placeholder="e.g. Quad sharing"
            value={group.customRoomType}
            onChange={(e) => onChange({ customRoomType: e.target.value.slice(0, 40) })}
            error={Boolean(errors?.custom)}
            helperText={errors?.custom}
            sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "background.default" } }}
          />
        ) : (
          <Box sx={{ display: { xs: "none", sm: "block" } }} />
        )}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "auto minmax(0, 1fr) minmax(0, 1fr)" }, gap: 1.5, mt: 1.75, alignItems: "end" }}>
        <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>Rooms</Typography>
          <Counter value={Number(group.numberOfRooms) || 1} onChange={(v) => onChange({ numberOfRooms: v })} min={1} max={MAX_ROOMS_PER_FLOOR} label="rooms" />
        </Box>
        <TextField
          select
          label="Beds per room"
          value={group.capacityPerRoom}
          onChange={(e) => onChange({ capacityPerRoom: Number(e.target.value) })}
          disabled={group.roomType === "Solo / Single"}
          sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "background.default" } }}
        >
          {CAPACITY_OPTIONS.map((n) => (
            <MenuItem key={n} value={n}>{n} {n === 1 ? "bed" : "beds"}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Rate per bed / month"
          value={group.monthlyRate}
          onChange={(e) => onChange({ monthlyRate: rateInput(e.target.value) })}
          error={Boolean(errors?.rate)}
          helperText={errors?.rate}
          slotProps={{ htmlInput: { inputMode: "numeric" }, input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> } }}
          sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "background.default" } }}
        />
      </Box>
    </Box>
  );
}

// The building, drawn as room squares: top floor first, like looking at it from the street
function BuildingPreview({ rooms, floors }) {
  const byFloor = Array.from({ length: floors }, (_, i) => rooms.filter((r) => Number(r.floor) === i + 1));
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {byFloor
        .map((list, i) => ({ list, floor: i + 1 }))
        .reverse()
        .map(({ list, floor }) => (
          <Box key={floor} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 30, flexShrink: 0, fontWeight: 700, textAlign: "right" }}>
              {floor}F
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
              {list.length === 0 && (
                <Typography variant="caption" color="text.disabled">No rooms</Typography>
              )}
              {list.slice(0, PREVIEW_PER_ROW).map((r, j) => (
                <Tooltip key={j} title={`Room ${r.roomName} · ${r.capacity} ${r.capacity === 1 ? "bed" : "beds"}`} disableInteractive>
                  <Box sx={{ width: 16, height: 16, borderRadius: "4px", bgcolor: "primary.main", opacity: 0.35 + Math.min(r.capacity, 8) * 0.08 }} />
                </Tooltip>
              ))}
              {list.length > PREVIEW_PER_ROW && (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, ml: 0.5 }}>+{list.length - PREVIEW_PER_ROW}</Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {list.length} · {list.reduce((s, r) => s + (Number(r.capacity) || 0), 0)} beds
            </Typography>
          </Box>
        ))}
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: (t) => alpha(t.palette.text.primary, 0.15), ml: "38px", mt: 0.25 }} />
    </Box>
  );
}

export default function Step3Rooms({ wizardData = {}, updateWizardData, onBack }) {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth() || {};

  const totalFloors = Math.max(1, Number(wizardData?.totalFloors) || 1);
  const saved = wizardData.roomLayout || {};

  // Picks up where the owner left off if they went back a step
  const [namingPattern, setNamingPattern] = useState(saved.namingPattern || wizardData.namingPattern || "floor");
  const [configMode, setConfigMode] = useState(saved.configMode || "uniform");
  const [uniform, setUniform] = useState(() => saved.uniform || newGroup());
  const [floorConfigs, setFloorConfigs] = useState(
    () => saved.floorConfigs || Array.from({ length: totalFloors }, (_, i) => ({ floorNumber: i + 1, roomGroups: [newGroup()] }))
  );
  const [activeFloor, setActiveFloor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [copied, setCopied] = useState("");

  // Keep one config per floor when the number of floors changed in step 2 (adjusted while rendering)
  const [floorsSynced, setFloorsSynced] = useState(totalFloors);
  if (floorsSynced !== totalFloors) {
    setFloorsSynced(totalFloors);
    setActiveFloor((f) => Math.min(f, totalFloors - 1));
    setFloorConfigs((prev) => {
      if (prev.length >= totalFloors) return prev.slice(0, totalFloors);
      const last = prev[prev.length - 1];
      const added = Array.from({ length: totalFloors - prev.length }, (_, i) => ({
        floorNumber: prev.length + i + 1,
        roomGroups: last ? last.roomGroups.map((g) => newGroup(g)) : [newGroup()],
      }));
      return [...prev, ...added];
    });
  }
  const safeFloor = Math.min(activeFloor, floorConfigs.length - 1);

  // Letters only go up to Z
  const alphaTooMany = totalFloors > MAX_ALPHA_FLOORS;
  const effectivePattern = namingPattern === "alpha" && alphaTooMany ? "floor" : namingPattern;

  const rooms = useMemo(() => {
    try {
      if (configMode === "uniform") {
        return buildUniformRooms({
          totalFloors,
          roomsPerFloor: Math.max(0, Number(uniform.numberOfRooms) || 0),
          capacityPerRoom: Math.max(0, Number(uniform.capacityPerRoom) || 0),
          monthlyRate: Math.max(0, Number(uniform.monthlyRate) || 0),
          namingPattern: effectivePattern,
        }).map((r) => ({ ...r, roomType: typeName(uniform) }));
      }
      return buildPerFloorRooms({
        namingPattern: effectivePattern,
        floorConfigs: floorConfigs.map((f) => ({
          ...f,
          roomGroups: f.roomGroups.map((g) => ({
            ...g,
            roomType: typeName(g),
            numberOfRooms: Math.max(0, Number(g.numberOfRooms) || 0),
            capacityPerRoom: Math.max(0, Number(g.capacityPerRoom) || 0),
            monthlyRate: Math.max(0, Number(g.monthlyRate) || 0),
          })),
        })),
      });
    } catch (err) {
      console.error("Room generation failed:", err);
      return [];
    }
  }, [configMode, uniform, floorConfigs, effectivePattern, totalFloors]);

  const summary = useMemo(() => (rooms.length ? computeSummary(rooms) : null), [rooms]);
  const totalBeds = rooms.reduce((s, r) => s + (Number(r.capacity) || 0), 0);
  const fullRent = rooms.reduce((s, r) => s + (Number(r.capacity) || 0) * (Number(r.monthlyRatePerBed) || 0), 0);

  // ---- validation (shown after the first save attempt) ----
  const groupErrors = (g) => {
    const e = {};
    if (!(Number(g.monthlyRate) > 0)) e.rate = "Set a rate above ₱0.";
    if (g.roomType === "Custom" && !g.customRoomType?.trim()) e.custom = "Give this room type a name.";
    return Object.keys(e).length ? e : null;
  };
  const allGroups = configMode === "uniform" ? [uniform] : floorConfigs.flatMap((f) => f.roomGroups);
  const invalidCount = allGroups.filter(groupErrors).length;
  const floorHasErrors = (f) => f.roomGroups.some(groupErrors);

  // ---- editing ----
  const patchUniform = (p) => setUniform((u) => ({ ...u, ...p }));
  const patchGroup = (floorIndex, groupId, p) =>
    setFloorConfigs((prev) => prev.map((f, i) => (i !== floorIndex ? f : { ...f, roomGroups: f.roomGroups.map((g) => (g.id === groupId ? { ...g, ...p } : g)) })));
  const addGroup = (floorIndex) =>
    setFloorConfigs((prev) => prev.map((f, i) => (i !== floorIndex ? f : { ...f, roomGroups: [...f.roomGroups, newGroup({ roomType: "Solo / Single", capacityPerRoom: 1, numberOfRooms: 2, monthlyRate: 4500 })] })));
  const removeGroup = (floorIndex, groupId) =>
    setFloorConfigs((prev) => prev.map((f, i) => (i !== floorIndex ? f : { ...f, roomGroups: f.roomGroups.filter((g) => g.id !== groupId) })));
  const copyFloor = (fromIndex, toAll) => {
    setFloorConfigs((prev) => prev.map((f, i) => ((toAll ? i > fromIndex : i === fromIndex + 1) ? { ...f, roomGroups: prev[fromIndex].roomGroups.map((g) => newGroup(g)) } : f)));
    setCopied(toAll ? `Copied to floors ${fromIndex + 2}–${totalFloors}.` : `Copied to the ${ordinal(fromIndex + 2)} floor.`);
    setTimeout(() => setCopied(""), 2500);
  };

  const layoutSnapshot = () => ({ namingPattern, configMode, uniform, floorConfigs });

  const goBack = () => {
    updateWizardData?.({ roomLayout: layoutSnapshot(), namingPattern: effectivePattern });
    onBack?.();
  };

  const handleSave = async () => {
    setError(null);
    setShowErrors(true);
    if (!rooms.length) {
      setError("Add at least one room.");
      return;
    }
    if (invalidCount > 0) {
      setError(`${invalidCount === 1 ? "One room type needs" : `${invalidCount} room types need`} fixing. They're marked in red.`);
      if (configMode === "perFloor") {
        const firstBad = floorConfigs.findIndex(floorHasErrors);
        if (firstBad >= 0) setActiveFloor(firstBad);
      }
      return;
    }

    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(wizardData).filter(([, v]) => v !== undefined));
      const finalWizardData = {
        ...clean,
        propertyName: clean.propertyName || "Untitled Property",
        totalFloors,
        amenities: clean.amenities || [],
        rules: clean.rules || [],
        estimatedRooms: rooms.length,
        namingPattern: effectivePattern,
        configMode,
      };
      updateWizardData?.({ roomLayout: layoutSnapshot() });

      const safeRooms = rooms.map((room) => {
        const r = { ...room };
        Object.keys(r).forEach((k) => {
          if (r[k] === undefined || Number.isNaN(r[k])) delete r[k];
        });
        return r;
      });

      const savedProperty = await saveProperty(finalWizardData, safeRooms, currentUser?.uid || "", clean.coverPhoto || null);

      navigate("/wizard-success", {
        state: {
          propertyId: savedProperty.id,
          propertyName: finalWizardData.propertyName,
          coverPhotoUrl: savedProperty.coverPhotoUrl,
          totalRooms: rooms.length,
          totalBeds,
          totalFloors,
          summary,
        },
      });
    } catch (err) {
      console.error("Save Property Error:", err);
      setError(err.message || "Something went wrong while saving your property. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const floor = floorConfigs[safeFloor];

  return (
    <Box>
      <StepHeader step={3} total={3} title="Rooms and beds" subtitle="Tell us how many rooms each floor has. Room numbers are made for you, and you can rename or fine-tune any room later." />

      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 } }}>
        {/* ───── Room numbers ───── */}
        <FormCard icon={TagOutlinedIcon} title="Room numbers">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
            {NAMING.map((n) => {
              const disabled = n.value === "alpha" && alphaTooMany;
              return (
                <ChoiceTile
                  key={n.value}
                  active={effectivePattern === n.value}
                  onClick={() => !disabled && setNamingPattern(n.value)}
                  title={n.title}
                  hint={disabled ? `Only up to ${MAX_ALPHA_FLOORS} floors` : n.hint(totalFloors)}
                  sx={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                />
              );
            })}
          </Box>
        </FormCard>

        {/* ───── Layout ───── */}
        <FormCard icon={LayersOutlinedIcon} title="Rooms on each floor" description={totalFloors === 1 ? "Your property has 1 floor." : `Your property has ${totalFloors} floors.`}>
          {totalFloors > 1 && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mb: 2 }}>
              <ChoiceTile active={configMode === "uniform"} onClick={() => setConfigMode("uniform")} icon={ViewAgendaOutlinedIcon} title="Same on every floor" hint="Quickest" />
              <ChoiceTile active={configMode === "perFloor"} onClick={() => setConfigMode("perFloor")} icon={DashboardOutlinedIcon} title="Different per floor" hint="Mix room types" />
            </Box>
          )}

          {configMode === "uniform" ? (
            <>
              {totalFloors > 1 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                  Each of the {totalFloors} floors gets:
                </Typography>
              )}
              <GroupEditor group={uniform} onChange={patchUniform} canRemove={false} errors={showErrors ? groupErrors(uniform) : null} />
              {totalFloors === 1 && (
                <Button size="small" startIcon={<AddIcon />} onClick={() => setConfigMode("perFloor")} sx={{ mt: 1.25, fontWeight: 700 }}>
                  Mix room types on this floor
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Floor picker */}
              {totalFloors > 1 && (
                <Box role="tablist" aria-label="Floor" sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.5, mb: 1.5, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
                  {floorConfigs.map((f, i) => {
                    const on = i === safeFloor;
                    const bad = showErrors && floorHasErrors(f);
                    const count = f.roomGroups.reduce((s, g) => s + (Number(g.numberOfRooms) || 0), 0);
                    return (
                      <Box
                        key={f.floorNumber}
                        component="button"
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setActiveFloor(i)}
                        sx={{
                          flexShrink: 0,
                          minWidth: 64,
                          px: 1.25,
                          py: 0.75,
                          borderRadius: "12px",
                          font: "inherit",
                          cursor: "pointer",
                          textAlign: "center",
                          border: "1.5px solid",
                          borderColor: bad ? "error.main" : on ? "text.primary" : "divider",
                          bgcolor: on ? "text.primary" : "background.default",
                          color: on ? "background.default" : "text.primary",
                        }}
                      >
                        <Box sx={{ fontWeight: 800, fontSize: 14 }}>{f.floorNumber}F</Box>
                        <Box sx={{ fontSize: 11.5, opacity: 0.7 }}>{count} rooms</Box>
                      </Box>
                    );
                  })}
                </Box>
              )}

              <Typography sx={{ fontFamily: HEAD, fontWeight: 800, mb: 1.25 }}>{ordinal(floor.floorNumber)} floor</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                {floor.roomGroups.map((g) => (
                  <GroupEditor
                    key={g.id}
                    group={g}
                    onChange={(p) => patchGroup(safeFloor, g.id, p)}
                    onRemove={() => removeGroup(safeFloor, g.id)}
                    canRemove={floor.roomGroups.length > 1}
                    errors={showErrors ? groupErrors(g) : null}
                  />
                ))}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5, alignItems: "center" }}>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addGroup(safeFloor)} sx={{ fontWeight: 700, borderRadius: "10px" }}>
                  Add another room type
                </Button>
                {safeFloor + 1 < totalFloors && (
                  <Button size="small" color="inherit" startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={() => copyFloor(safeFloor, false)} sx={{ fontWeight: 700, color: "text.secondary" }}>
                    Copy to {ordinal(safeFloor + 2)} floor
                  </Button>
                )}
                {safeFloor + 2 < totalFloors && (
                  <Button size="small" color="inherit" startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={() => copyFloor(safeFloor, true)} sx={{ fontWeight: 700, color: "text.secondary" }}>
                    Copy to all floors above
                  </Button>
                )}
                {copied && (
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "success.dark", fontWeight: 700 }}>
                    <CheckIcon sx={{ fontSize: 15 }} /> {copied}
                  </Typography>
                )}
              </Box>
            </>
          )}
        </FormCard>

        {/* ───── Live preview ───── */}
        <FormCard icon={ApartmentOutlinedIcon} title="Your building" description="Each square is a room. Darker squares have more beds.">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1, mb: 2 }}>
            {[
              { label: "Floors", value: totalFloors },
              { label: "Rooms", value: rooms.length },
              { label: "Beds", value: totalBeds },
              { label: "Rent when full", value: peso(fullRent), sub: "per month" },
            ].map((t) => (
              <Box key={t.label} sx={{ p: 1.5, borderRadius: "14px", bgcolor: (th) => alpha(th.palette.background.paper, 0.55), minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t.label}</Typography>
                <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 900, fontSize: "1.3rem", lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{t.value}</Typography>
                {t.sub && <Typography variant="caption" color="text.secondary">{t.sub}</Typography>}
              </Box>
            ))}
          </Box>
          {rooms.length > 0 ? (
            <BuildingPreview rooms={rooms} floors={totalFloors} />
          ) : (
            <Typography variant="body2" color="text.secondary">Add rooms above to see your building.</Typography>
          )}
        </FormCard>

        {error && <Alert severity="error" sx={{ borderRadius: "14px" }}>{error}</Alert>}
      </Box>

      <WizardFooter
        onBack={goBack}
        primaryLabel={saving ? "Creating…" : authLoading ? "Checking your account…" : `Create property`}
        onPrimary={handleSave}
        busy={saving || authLoading}
        hint={`${rooms.length} ${rooms.length === 1 ? "room" : "rooms"} · ${totalBeds} ${totalBeds === 1 ? "bed" : "beds"}`}
        primaryIcon={<CheckIcon />}
      />
    </Box>
  );
}
