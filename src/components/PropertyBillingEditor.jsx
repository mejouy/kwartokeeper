// Property → Billing: does this property follow the owner's usual billing
// rules (Account → Billing rules), or its own? Its own rules cover the rent
// due date, the late fee and the move-in payments; every tenant of the
// property, and the caretakers working there, see bills worked out with them.
// Fee types stay the owner's (one list for every property).
//
// Controlled: the page keeps the draft and saves it with the property.
import { Box, FormControlLabel, InputAdornment, MenuItem, Radio, RadioGroup, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DueDayField from "./DueDayField";
import { MAX_GRACE_DAYS, MAX_MOVE_IN_MONTHS, describeLateFee } from "../utils/billingSettings";
import { t } from "../i18n";

const dueText = (mode, day) =>
  mode === "15" ? t("Every 15th") : mode === "30" ? t("Every 30th (or the month's last day)") : mode === "lease" ? t("Same date as the lease start") : t("Every {day} of the month", { day: ordinal(day) });
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const moveInText = (m) =>
  [m.advanceMonths ? (m.advanceMonths === 1 ? t("1 month advance") : t("{n} months advance", { n: m.advanceMonths })) : "", m.depositMonths ? (m.depositMonths === 1 ? t("1 month deposit") : t("{n} months deposit", { n: m.depositMonths })) : ""].filter(Boolean).join(" · ") || t("Nothing at move-in");

export function SummaryLine({ label, value }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "180px minmax(0, 1fr)" }, gap: { xs: 0.25, sm: 1.5 }, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

/**
 * owner: the owner's usual rules (normalized). value: the draft
 * { custom, defaultDueMode, defaultDueDay, lateFee: { enabled, mode, amount, graceDays }, moveIn }
 * (amounts as typed text). errors: { defaultDueDay, lateFeeAmount, lateFeeGrace }.
 */
export default function PropertyBillingEditor({ owner, value, onChange, errors = {} }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const setLate = (patch) => set({ lateFee: { ...value.lateFee, ...patch } });
  const late = value.lateFee;

  return (
    <Box>
      <RadioGroup value={value.custom ? "custom" : "owner"} onChange={(e) => set({ custom: e.target.value === "custom" })} sx={{ gap: 1 }}>
        {[
          ["owner", t("Use my usual billing rules"), t("Changes you make in Account → Billing rules apply here too.")],
          ["custom", t("Custom rules for this property"), t("Set a different due date, late fee or move-in payments just for this property.")],
        ].map(([key, title, hint]) => {
          const on = (key === "custom") === Boolean(value.custom);
          return (
            <Box
              key={key}
              component="label"
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                p: 1.5,
                pr: 2,
                borderRadius: "12px",
                border: "1px solid",
                borderColor: on ? "primary.main" : "divider",
                bgcolor: (th) => (on ? alpha(th.palette.primary.main, 0.05) : "transparent"),
                cursor: "pointer",
              }}
            >
              <Radio value={key} sx={{ p: 0.5 }} />
              <Box sx={{ minWidth: 0, pt: 0.5 }}>
                <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
                <Typography variant="body2" color="text.secondary">{hint}</Typography>
              </Box>
            </Box>
          );
        })}
      </RadioGroup>

      {!value.custom ? (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: "12px", bgcolor: (th) => alpha(th.palette.background.paper, 0.5) }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }}>
            {t("This property follows")}
          </Typography>
          <SummaryLine label={t("Rent due")} value={dueText(owner.defaultDueMode, owner.defaultDueDay)} />
          <SummaryLine label={t("Late fee")} value={describeLateFee(owner.lateFee)} />
          <SummaryLine label={t("Move-in payments")} value={moveInText(owner.moveIn)} />
        </Box>
      ) : (
        <Box sx={{ mt: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>{t("Rent due date for new tenants")}</Typography>
            <DueDayField
              label={t("New tenants pay")}
              value={{ mode: value.defaultDueMode, day: value.defaultDueDay }}
              onChange={({ mode, day }) => set({ defaultDueMode: mode, defaultDueDay: day })}
              helperText={errors.defaultDueDay || t("Current tenants keep their own due day; change it on their profile.")}
              sx={{ maxWidth: { sm: 560 } }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{t("Late fee")}</Typography>
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
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>{t("Move-in payments")}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
              {[
                ["advanceMonths", t("Advance rent")],
                ["depositMonths", t("Security deposit")],
              ].map(([key, label]) => (
                <TextField key={key} select label={label} value={value.moveIn[key]} onChange={(e) => set({ moveIn: { ...value.moveIn, [key]: Number(e.target.value) } })}>
                  {Array.from({ length: MAX_MOVE_IN_MONTHS + 1 }, (_, n) => (
                    <MenuItem key={n} value={n}>
                      {n === 0 ? t("None") : n === 1 ? t("1 month of rent") : t("{n} months of rent", { n })}
                    </MenuItem>
                  ))}
                </TextField>
              ))}
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary">
            {t("Fee types stay the same for all your properties (Account → Billing rules).")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
