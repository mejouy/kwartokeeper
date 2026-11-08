// Extra fees on top of rent (see utils/charges.js):
//  - AddFeeDialog: the owner adds a fee for one or more tenants, or edits one
//  - FeeList: a tenant's fees, with Edit / Stop / Remove for the owner
//  - BillBreakdown: rent + fees = total for a month, shown to everyone
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  FEE_TYPES,
  addCharges,
  describeRepeat,
  feePeriodOptions,
  feeTypeLabel,
  isActiveCharge,
  periodIndex,
  periodOfDate,
  removeCharge,
  round2,
  splitAmount,
  stopCharge,
  updateCharge,
} from "../utils/charges";
import { t } from "../i18n";

const HEAD = '"Inter", sans-serif';
const row = { display: "flex", alignItems: "center" };
const MAX_FEE = 1000000;
const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const paperSx = { borderRadius: "20px", m: { xs: 2, sm: 4 }, width: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" }, maxHeight: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" } };

const blankForm = (period) => ({ type: "electricity", label: "", amount: "", split: "each", repeat: "once", period, note: "" });

/**
 * tenants: [{ id, name, propertyId, propertyName, roomNumber }]
 * charges: the owner's existing fees (to stop exact duplicates)
 * editing: a fee to change instead of adding new ones
 */
export function AddFeeDialog({ open, onClose, onSaved, ownerUid, tenants = [], initialTenantIds = [], charges = [], editing = null }) {
  const today = useMemo(() => new Date(), []);
  const periods = useMemo(() => feePeriodOptions(today), [today]);
  const thisMonth = periodOfDate(today);
  const [form, setForm] = useState(() => (editing ? { type: editing.type || "other", label: editing.label || "", amount: String(editing.amount ?? ""), split: "each", repeat: editing.repeat === "monthly" ? "monthly" : "once", period: editing.period || thisMonth, note: editing.note || "" } : blankForm(thisMonth)));
  const [picked, setPicked] = useState(() => new Set(editing ? [editing.tenantId] : initialTenantIds));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e, form: undefined };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  // The period list always includes the fee's own month, even an older one
  const periodChoices = useMemo(() => (form.period && !periods.includes(form.period) ? [form.period, ...periods] : periods), [form.period, periods]);

  const rooms = useMemo(() => {
    const map = new Map();
    tenants.forEach((t) => {
      const key = `${t.propertyName || ""}|${t.roomNumber || "No room"}`;
      if (!map.has(key)) map.set(key, { key, label: `${t.roomNumber ? `Room ${t.roomNumber}` : "No room"}${new Set(tenants.map((x) => x.propertyId)).size > 1 ? ` · ${t.propertyName}` : ""}`, tenants: [] });
      map.get(key).tenants.push(t);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [tenants]);

  const chosen = tenants.filter((t) => picked.has(t.id));
  const amountNum = round2(form.amount);
  const splitting = !editing && form.split === "split" && chosen.length > 1;
  const amounts = splitting ? splitAmount(amountNum, chosen.length) : chosen.map(() => amountNum);
  const label = form.label.trim() || (form.type === "other" ? "" : feeTypeLabel(form.type));

  const toggle = (ids, on) =>
    setPicked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const validate = () => {
    const e = {};
    if (!editing && chosen.length === 0) e.tenants = "Choose at least one tenant.";
    if (!label) e.label = "Name this fee, e.g. Aircon use.";
    else if (label.length > 40) e.label = "Keep the name under 40 characters.";
    const raw = String(form.amount).trim();
    if (!raw || !(Number(raw) > 0)) e.amount = "Enter an amount above zero.";
    else if (!/^\d+(\.\d{1,2})?$/.test(raw)) e.amount = "Use at most 2 decimal places.";
    else if (Number(raw) > MAX_FEE) e.amount = "That amount looks too large.";
    else if (splitting && amounts.some((a) => !(a > 0))) e.amount = "That's too little to split between this many tenants.";
    if (!form.period) e.period = "Pick the month.";
    if (form.note.length > 200) e.note = "Keep the note under 200 characters.";
    // The same fee twice for the same tenant and month is almost always a double entry
    if (!e.label && !e.period) {
      const same = (c) =>
        isActiveCharge(c) &&
        c.id !== editing?.id &&
        String(c.label || "").trim().toLowerCase() === label.toLowerCase() &&
        c.period === form.period &&
        (c.repeat === "monthly") === (form.repeat === "monthly");
      const dupes = (editing ? [editing.tenantId] : chosen.map((t) => t.id)).filter((id) => charges.some((c) => c.tenantId === id && same(c)));
      if (dupes.length) {
        const names = dupes.map((id) => tenants.find((t) => t.id === id)?.name || "This tenant");
        e.form = `${names.length === 1 ? names[0] : `${names.length} of these tenants`} already ${names.length === 1 ? "has" : "have"} "${label}" for ${form.period}. Edit that fee instead of adding it again.`;
      }
    }
    return e;
  };

  const save = async () => {
    if (saving) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCharge(editing.id, { type: form.type, label, amount: amountNum, repeat: form.repeat, period: form.period, note: form.note.trim(), ...(form.repeat === "monthly" ? {} : { endPeriod: "" }) });
        onSaved?.(`Saved ${label}.`);
      } else {
        await addCharges({ ownerUid, tenants: chosen, amounts, type: form.type, label, repeat: form.repeat, period: form.period, note: form.note });
        onSaved?.(chosen.length === 1 ? `Added ${label} for ${chosen[0].name}. They've been notified.` : `Added ${label} for ${chosen.length} tenants. They've been notified.`);
      }
      onClose();
    } catch (err) {
      console.error("Couldn't save the fee:", err);
      setErrors({ form: "Couldn't save the fee. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  const close = () => !saving && onClose();

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" slotProps={{ paper: { sx: paperSx } }}>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1, px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main", flexShrink: 0 }}>
            <BoltOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.15rem", lineHeight: 1.2 }}>{editing ? t("Edit fee") : t("Add a fee")}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {editing ? `${editing.tenantName || "Tenant"} · ${editing.roomNumber ? `Room ${editing.roomNumber}` : ""}` : t("Charges not included in the room or bed rate")}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={close} size="small" aria-label={t("Close")} disabled={saving} sx={{ bgcolor: "action.hover" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 2, sm: 3 }, "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}>
        {errors.form && <Alert severity="error" sx={{ mb: 2.5, borderRadius: "10px" }}>{errors.form}</Alert>}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 0.5 }}>
          {/* What the fee is for */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>{t("What is it for?")}</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {FEE_TYPES.map((t) => {
                const on = form.type === t.key;
                return (
                  <Box
                    key={t.key}
                    component="button"
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ type: t.key, label: t.key === "other" ? "" : form.label && FEE_TYPES.some((x) => x.label === form.label) ? "" : form.label })}
                    sx={{ height: 36, px: 1.5, borderRadius: 99, font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "1px solid", borderColor: on ? "text.primary" : "divider", bgcolor: on ? "text.primary" : "background.default", color: on ? "background.default" : "text.secondary" }}
                  >
                    {t.label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1.3fr) minmax(0, 1fr)" }, gap: 2 }}>
            <TextField
              fullWidth
              label={form.type === "other" ? "Name of the fee" : "Name shown to tenants"}
              placeholder={form.type === "other" ? "e.g. Aircon use" : feeTypeLabel(form.type)}
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              error={Boolean(errors.label)}
              helperText={errors.label || (form.type === "other" ? "" : `Leave blank to use "${feeTypeLabel(form.type)}"`)}
              slotProps={{ htmlInput: { maxLength: 40 }, inputLabel: { shrink: true } }}
            />
            <TextField
              fullWidth
              label={splitting ? "Total bill to split" : "Amount"}
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
              error={Boolean(errors.amount)}
              helperText={errors.amount || (splitting && amountNum > 0 ? `${peso(amounts[amounts.length - 1])}${amounts[0] !== amounts[amounts.length - 1] ? `–${peso(amounts[0])}` : ""} each for ${chosen.length} tenants` : "")}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
            />
          </Box>

          {/* When it applies */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 2, alignItems: "start" }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>{t("How often")}</Typography>
              <ToggleButtonGroup exclusive fullWidth size="small" value={form.repeat} onChange={(_, v) => v && set({ repeat: v })} sx={{ "& .MuiToggleButton-root": { fontWeight: 700, textTransform: "none", minHeight: 40 } }}>
                <ToggleButton value="once">{t("One month")}</ToggleButton>
                <ToggleButton value="monthly">{t("Every month")}</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <TextField select fullWidth label={form.repeat === "monthly" ? "Starting" : "For the month of"} value={form.period} onChange={(e) => set({ period: e.target.value })} error={Boolean(errors.period)} helperText={errors.period || ""} sx={{ mt: { sm: 3.6 } }}>
              {periodChoices.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                  {p === thisMonth ? t(" (this month)") : ""}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <TextField
            fullWidth
            multiline
            minRows={2}
            label={t("Note for the tenant (optional)")}
            placeholder={form.type === "electricity" ? "e.g. Meter 1203 → 1290 kWh × ₱12" : "e.g. Shared kitchen, October"}
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            error={Boolean(errors.note)}
            helperText={errors.note || `${form.note.length}/200`}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />

          {/* Who pays it */}
          {!editing && (
            <Box>
              <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t("Tenants")}{" "}{chosen.length > 0 && <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>· {chosen.length}{" "}{t("chosen")}</Box>}
                </Typography>
                {tenants.length > 1 && (
                  <Button size="small" onClick={() => toggle(tenants.map((t) => t.id), chosen.length !== tenants.length)} sx={{ fontWeight: 700 }}>
                    {chosen.length === tenants.length ? t("Clear all") : t("Choose all")}
                  </Button>
                )}
              </Box>
              {errors.tenants && <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>{errors.tenants}</Typography>}
              {tenants.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t("No current tenants to charge.")}</Typography>
              ) : (
                <Box sx={{ border: "1px solid", borderColor: errors.tenants ? "error.main" : "divider", borderRadius: "14px", maxHeight: 260, overflowY: "auto" }}>
                  {rooms.map((r, i) => {
                    const ids = r.tenants.map((t) => t.id);
                    const all = ids.every((id) => picked.has(id));
                    const some = !all && ids.some((id) => picked.has(id));
                    return (
                      <Box key={r.key} sx={{ borderTop: i ? "1px solid" : "none", borderColor: "divider" }}>
                        <Box component="label" sx={{ ...row, gap: 0.5, px: 1, py: 0.25, bgcolor: (t) => alpha(t.palette.background.paper, 0.45), cursor: "pointer" }}>
                          <Checkbox size="small" checked={all} indeterminate={some} onChange={(e) => toggle(ids, e.target.checked)} slotProps={{ input: { "aria-label": `Everyone in ${r.label}` } }} />
                          <Typography variant="body2" sx={{ fontWeight: 800, minWidth: 0 }} noWrap>{r.label}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto", pr: 1, flexShrink: 0 }}>{r.tenants.length}</Typography>
                        </Box>
                        {r.tenants.map((t) => (
                          <Box key={t.id} component="label" sx={{ ...row, gap: 0.5, pl: 3, pr: 1, py: 0.25, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                            <Checkbox size="small" checked={picked.has(t.id)} onChange={(e) => toggle([t.id], e.target.checked)} />
                            <Typography variant="body2" sx={{ minWidth: 0 }} noWrap>{t.name}</Typography>
                          </Box>
                        ))}
                      </Box>
                    );
                  })}
                </Box>
              )}
              {chosen.length > 1 && (
                <ToggleButtonGroup exclusive fullWidth size="small" value={form.split} onChange={(_, v) => v && set({ split: v })} sx={{ mt: 1.5, "& .MuiToggleButton-root": { fontWeight: 700, textTransform: "none", minHeight: 40 } }}>
                  <ToggleButton value="each">{t("Same amount each")}</ToggleButton>
                  <ToggleButton value="split">{t("Split one bill")}</ToggleButton>
                </ToggleButtonGroup>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1, borderTop: "1px solid", borderColor: "divider" }}>
        <Button onClick={close} disabled={saving} sx={{ fontWeight: 700 }}>{t("Cancel")}</Button>
        <Button variant="contained" disableElevation onClick={save} disabled={saving} sx={{ fontWeight: 700, borderRadius: "10px", minWidth: 120 }}>
          {saving ? <CircularProgress size={20} color="inherit" /> : editing ? t("Save fee") : chosen.length > 1 ? `Add for ${chosen.length}` : t("Add fee")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Rent, each fee, and the total for one month. bill comes from monthBill(). */
export function BillBreakdown({ bill, dark = false, showPaid = true }) {
  if (!bill) return null;
  const muted = dark ? "rgba(255,255,255,.7)" : "text.secondary";
  const line = (labelText, value, opts = {}) => (
    <Box key={labelText + (opts.k || "")} sx={{ ...row, justifyContent: "space-between", gap: 2, py: 0.4 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: opts.bold ? 800 : 600, color: opts.color || (dark ? "#fff" : "text.primary") }} noWrap>{labelText}</Typography>
        {opts.note && <Typography variant="caption" sx={{ color: muted, display: "block", overflowWrap: "anywhere" }}>{opts.note}</Typography>}
      </Box>
      <Typography variant="body2" sx={{ fontWeight: opts.bold ? 900 : 700, flexShrink: 0, color: opts.color || (dark ? "#fff" : "text.primary") }}>{value}</Typography>
    </Box>
  );
  return (
    <Box>
      {line("Rent", peso(bill.rent))}
      {bill.fees.map((c) => line(c.label || feeTypeLabel(c.type), peso(c.amount), { note: c.note, k: c.id }))}
      <Box sx={{ borderTop: "1px solid", borderColor: dark ? "rgba(255,255,255,.18)" : "divider", mt: 0.5, pt: 0.5 }}>
        {line("Total", peso(bill.total), { bold: true })}
        {showPaid && bill.received > 0 && line("Received", `− ${peso(bill.received)}`, { color: dark ? "#9be7b0" : "success.dark" })}
        {showPaid && bill.received > 0 && line(bill.balance > 0 ? "Still due" : "Balance", bill.balance > 0 ? peso(bill.balance) : "Fully paid", { bold: true, color: bill.balance > 0 ? (dark ? "#ffb38a" : "warning.dark") : dark ? "#9be7b0" : "success.dark" })}
      </Box>
    </Box>
  );
}

/**
 * A list of fees. With onEdit (owner), each fee gets Edit / Stop / Remove.
 * Removing keeps the record (status "removed"); stopping ends a monthly fee.
 */
export function FeeList({ charges, onEdit, onDone, emptyText = "No extra fees.", currentPeriod, showTenant = false }) {
  const [menu, setMenu] = useState({ anchor: null, charge: null });
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);
  const list = charges.filter(isActiveCharge).sort((a, b) => (periodIndex(b.period) ?? 0) - (periodIndex(a.period) ?? 0));
  const thisMonth = currentPeriod || periodOfDate(new Date());

  const run = async (charge, action) => {
    setBusy(charge.id);
    try {
      // A monthly fee that hasn't started yet has nothing to keep: stopping it removes it
      if (action === "stop" && periodIndex(charge.period) <= periodIndex(thisMonth)) await stopCharge(charge.id, thisMonth);
      else await removeCharge(charge.id);
      onDone?.(action === "stop" ? `${charge.label} stops after ${thisMonth}.` : `Removed ${charge.label}.`);
    } catch (err) {
      console.error("Couldn't change the fee:", err);
      onDone?.("Couldn't change the fee. Please try again.", "error");
    } finally {
      setBusy("");
      setConfirm(null);
    }
  };

  if (list.length === 0) return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {list.map((c, i) => {
          const ended = c.repeat === "monthly" && c.endPeriod && periodIndex(c.endPeriod) < periodIndex(thisMonth);
          return (
            <Box key={c.id} sx={{ ...row, gap: 1.25, py: 1.25, borderTop: i ? "1px solid" : "none", borderColor: "divider", opacity: ended ? 0.6 : 1 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 800, lineHeight: 1.3 }} noWrap>{c.label || feeTypeLabel(c.type)}</Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: "anywhere" }}>
                  {showTenant ? `${c.tenantName || "Tenant"}${c.roomNumber ? ` · Room ${c.roomNumber}` : ""} · ` : ""}
                  {describeRepeat(c)}
                  {ended ? t(" · ended") : ""}
                  {c.note ? ` · ${c.note}` : ""}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: HEAD, fontWeight: 800, flexShrink: 0 }}>{peso(c.amount)}</Typography>
              {onEdit && (
                <IconButton aria-label={`Options for ${c.label}`} disabled={busy === c.id} onClick={(e) => setMenu({ anchor: e.currentTarget, charge: c })} sx={{ width: 38, height: 38, flexShrink: 0 }}>
                  {busy === c.id ? <CircularProgress size={16} /> : <MoreVertIcon fontSize="small" />}
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, charge: null })}>
        <MenuItem
          onClick={() => {
            onEdit?.(menu.charge);
            setMenu({ anchor: null, charge: null });
          }}
        >
          {t("Edit")}
        </MenuItem>
        {menu.charge?.repeat === "monthly" && !menu.charge?.endPeriod && (
          <MenuItem
            onClick={() => {
              setConfirm({ charge: menu.charge, action: "stop" });
              setMenu({ anchor: null, charge: null });
            }}
          >
            {t("Stop after")}{" "}{thisMonth}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setConfirm({ charge: menu.charge, action: "remove" });
            setMenu({ anchor: null, charge: null });
          }}
          sx={{ color: "error.main" }}
        >
          {t("Remove")}
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: paperSx } }}>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.1rem", mb: 1 }}>
            {confirm?.action === "stop" ? `Stop ${confirm?.charge?.label}?` : `Remove ${confirm?.charge?.label}?`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {confirm?.action === "stop"
              ? `It still counts for ${thisMonth} and earlier months, and won't be added from next month.`
              : t("It won't count toward any month anymore, including past months that aren't paid yet. Payments already made are not changed.")}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirm(null)} disabled={Boolean(busy)} sx={{ fontWeight: 700 }}>{t("Cancel")}</Button>
          <Button variant="contained" disableElevation color={confirm?.action === "stop" ? "primary" : "error"} disabled={Boolean(busy)} onClick={() => run(confirm.charge, confirm.action)} sx={{ fontWeight: 700, borderRadius: "10px" }}>
            {busy ? <CircularProgress size={18} color="inherit" /> : confirm?.action === "stop" ? t("Stop it") : t("Remove")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
