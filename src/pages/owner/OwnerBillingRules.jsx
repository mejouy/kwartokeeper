// Owner → Account → Billing rules (panel revisions: "singilan, make it editable
// according to the owner's need"). Rendered inside OwnerAccount with that page's
// own Section card and Save button, so it looks like the other sections.
// Rules and where they apply: utils/billingSettings.js.
import { useEffect, useState } from "react";
import { Alert, Box, Button, FormControlLabel, IconButton, InputAdornment, MenuItem, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import AlarmOutlinedIcon from "@mui/icons-material/AlarmOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import { doc, onSnapshot } from "firebase/firestore";
import DueDayField from "../../components/DueDayField";
import { db } from "../../config/firebase";
import { MAX_FEE_TYPES, MAX_GRACE_DAYS, MAX_MOVE_IN_MONTHS, describeLateFee, normalizeBilling, saveBillingSettings, validateBilling } from "../../utils/billingSettings";
import { t } from "../../i18n";

const row = { display: "flex", alignItems: "center" };

// The form keeps amounts as typed text; saving turns them back into numbers
const toDraft = (s) => ({
  ...s,
  lateFee: { ...s.lateFee, amount: s.lateFee.amount ? String(s.lateFee.amount) : "", graceDays: String(s.lateFee.graceDays) },
  feeTypes: s.feeTypes.map((f) => ({ ...f, defaultAmount: f.defaultAmount ? String(f.defaultAmount) : "" })),
});
const fromDraft = (d) => ({
  ...d,
  defaultDueDay: Number(d.defaultDueDay),
  lateFee: { ...d.lateFee, amount: Number(d.lateFee.amount) || 0, graceDays: Number(d.lateFee.graceDays) },
  feeTypes: d.feeTypes.map((f) => ({ ...f, label: String(f.label || "").trim(), defaultAmount: Number(f.defaultAmount) || 0 })),
});

function Heading({ icon: Icon, children, first }) {
  return (
    <Box sx={{ ...row, gap: 1, mb: 1.5, ...(first ? {} : { mt: 3, pt: 2.5, borderTop: "1px solid", borderColor: "divider" }) }}>
      <Icon sx={{ fontSize: 18, color: "text.secondary" }} />
      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>{children}</Typography>
    </Box>
  );
}

export default function OwnerBillingRules({ ownerUid, Section, SaveButton, icon, notify }) {
  const [saved, setSaved] = useState(null); // what is saved now (normalized)
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ownerUid) return undefined;
    return onSnapshot(
      doc(db, "users", ownerUid),
      (snap) => {
        const next = normalizeBilling(snap.data()?.billingSettings);
        setSaved(next);
        // Only fill the form the first time, so live updates never fight typing
        setDraft((d) => d || toDraft(next));
      },
      (err) => console.warn("Couldn't load the billing rules:", err?.code || err)
    );
  }, [ownerUid]);

  if (!draft) return null;

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
  };
  const setLate = (patch) => set({ lateFee: { ...draft.lateFee, ...patch } });
  const setFee = (i, patch) => set({ feeTypes: draft.feeTypes.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const changed = JSON.stringify(normalizeBilling(fromDraft(draft))) !== JSON.stringify(saved);

  const save = async () => {
    const values = fromDraft(draft);
    const e = validateBilling(values);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await saveBillingSettings(ownerUid, values);
      setDraft(toDraft(normalizeBilling(values)));
      notify?.("Billing rules saved. Every bill now follows them.");
    } catch (err) {
      console.error("Couldn't save the billing rules:", err);
      notify?.("Couldn't save the billing rules. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const late = draft.lateFee;

  return (
    <Section
      id="billing"
      icon={icon}
      title={t("Billing rules")}
      subtitle={t("Due dates, your own fees, the late fee, and what to collect at move-in.")}
      footer={
        <>
          {changed && (
            <Button color="inherit" onClick={() => setDraft(toDraft(saved))} disabled={busy} sx={{ fontWeight: 700 }}>
              {t("Undo changes")}
            </Button>
          )}
          <SaveButton busy={busy} disabled={!changed} onClick={save}>
            {busy ? t("Saving…") : t("Save billing rules")}
          </SaveButton>
        </>
      }
    >
      {/* Due date */}
      <Heading icon={EventOutlinedIcon} first>
        {t("Rent due date")}
      </Heading>
      <DueDayField
        label={t("New tenants pay")}
        value={{ mode: draft.defaultDueMode, day: draft.defaultDueDay }}
        onChange={({ mode, day }) => set({ defaultDueMode: mode, defaultDueDay: day })}
        helperText={errors.defaultDueDay || t("Each tenant can have their own due day. Change it on their profile.")}
        sx={{ maxWidth: { sm: 560 } }}
      />

      {/* Late fee */}
      <Heading icon={AlarmOutlinedIcon}>{t("Late fee")}</Heading>
      <FormControlLabel
        control={<Switch checked={late.enabled} onChange={(e) => setLate({ enabled: e.target.checked })} />}
        label={<Typography sx={{ fontWeight: 700 }}>{t("Add a late fee automatically")}</Typography>}
      />
      {late.enabled && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "auto minmax(0, 1fr) minmax(0, 1fr)" }, gap: 2, mt: 1.5, alignItems: "start" }}>
          <ToggleButtonGroup exclusive size="small" value={late.mode} onChange={(_, v) => v && setLate({ mode: v })} sx={{ "& .MuiToggleButton-root": { fontWeight: 700, textTransform: "none", minHeight: 40, px: 2 } }}>
            <ToggleButton value="fixed">{t("Fixed ₱")}</ToggleButton>
            <ToggleButton value="percent">{t("% of rent")}</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label={late.mode === "percent" ? t("Percent of the rent") : t("Amount")}
            value={late.amount}
            onChange={(e) => setLate({ amount: e.target.value.replace(/[^\d.]/g, "") })}
            error={Boolean(errors.lateFeeAmount)}
            helperText={errors.lateFeeAmount || ""}
            slotProps={{
              input: late.mode === "percent" ? { endAdornment: <InputAdornment position="end">%</InputAdornment> } : { startAdornment: <InputAdornment position="start">₱</InputAdornment> },
              htmlInput: { inputMode: "decimal" },
            }}
          />
          <TextField
            label={t("Grace days after the due date")}
            value={late.graceDays}
            onChange={(e) => setLate({ graceDays: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            error={Boolean(errors.lateFeeGrace)}
            helperText={errors.lateFeeGrace || t("0 to {max} days", { max: MAX_GRACE_DAYS })}
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
        </Box>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {late.enabled
          ? t("Now: {rule}. Added once a month to rent that is still unpaid; rent sent on time never gets one. You can waive it for a month on the tenant's profile.", { rule: describeLateFee(fromDraft(draft).lateFee) })
          : t("No late fee. Overdue rent is only reminded.")}
      </Typography>

      {/* Owner's own fee types */}
      <Heading icon={SellOutlinedIcon}>{t("Your fee types")}</Heading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("Fees you charge often, with their usual amount. They show first in Add a fee, already filled in.")}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {draft.feeTypes.map((f, i) => (
          <Box key={f.key || i} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) auto", sm: "minmax(0, 1.4fr) minmax(0, 1fr) auto auto" }, gap: 1, alignItems: "start" }}>
            <TextField size="small" label={t("Name")} placeholder={t("e.g. Aircon use")} value={f.label} onChange={(e) => setFee(i, { label: e.target.value.slice(0, 40) })} error={Boolean(errors[`fee${i}`])} helperText={errors[`fee${i}`] || ""} />
            <IconButton aria-label={t("Remove {name}", { name: f.label || t("this fee") })} onClick={() => set({ feeTypes: draft.feeTypes.filter((_, j) => j !== i) })} sx={{ gridColumn: { xs: 2, sm: 4 }, gridRow: { xs: 1, sm: "auto" } }}>
              <DeleteOutlineIcon />
            </IconButton>
            <TextField
              size="small"
              label={t("Usual amount")}
              value={f.defaultAmount}
              onChange={(e) => setFee(i, { defaultAmount: e.target.value.replace(/[^\d.]/g, "") })}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
              sx={{ gridColumn: { xs: 1, sm: 2 }, gridRow: { xs: 2, sm: 1 } }}
            />
            <ToggleButtonGroup exclusive size="small" value={f.repeat} onChange={(_, v) => v && setFee(i, { repeat: v })} sx={{ gridColumn: { xs: "1 / -1", sm: 3 }, gridRow: { xs: 3, sm: 1 }, "& .MuiToggleButton-root": { fontWeight: 700, textTransform: "none", minHeight: 40 } }}>
              <ToggleButton value="once">{t("One month")}</ToggleButton>
              <ToggleButton value="monthly">{t("Every month")}</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        ))}
      </Box>
      {draft.feeTypes.length < MAX_FEE_TYPES && (
        <Button startIcon={<AddIcon />} onClick={() => set({ feeTypes: [...draft.feeTypes, { key: `custom-${Date.now().toString(36)}`, label: "", defaultAmount: "", repeat: "monthly" }] })} sx={{ mt: 1, fontWeight: 700 }}>
          {t("Add a fee type")}
        </Button>
      )}

      {/* Move-in payments */}
      <Heading icon={KeyOutlinedIcon}>{t("Move-in payments")}</Heading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("Optional. Register Tenant suggests these for the move-in month; you can change them for each tenant. Advance rent pays for the months right after; the deposit is refundable.")}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        {[
          ["advanceMonths", t("Advance rent")],
          ["depositMonths", t("Security deposit")],
        ].map(([key, label]) => (
          <TextField key={key} select label={label} value={draft.moveIn[key]} onChange={(e) => set({ moveIn: { ...draft.moveIn, [key]: Number(e.target.value) } })}>
            {Array.from({ length: MAX_MOVE_IN_MONTHS + 1 }, (_, n) => (
              <MenuItem key={n} value={n}>
                {n === 0 ? t("None") : n === 1 ? t("1 month of rent") : t("{n} months of rent", { n })}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Box>
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: "10px" }}>
          {t("Check the highlighted fields.")}
        </Alert>
      )}
    </Section>
  );
}
