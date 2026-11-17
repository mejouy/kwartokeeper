// Picking when rent is due (panel revisions): every 15th, every 30th, the same
// date as the lease start, or a custom day. Used by Register tenant, the
// tenant's profile and the owner's Billing rules. Rules: utils/tenantRent.js.
import { Box, MenuItem, TextField } from "@mui/material";
import { DUE_MODES, ordinalDay, resolveDueDay } from "../utils/tenantRent";
import { t } from "../i18n";

/**
 * value: { mode: "15" | "30" | "lease" | "custom", day }
 * leaseStart: the lease start date ("2026-11-12"), to show which day "lease" means.
 *   Leave it out (Billing rules) and "lease" reads as each tenant's own start date.
 */
export default function DueDayField({ value, onChange, leaseStart, label = t("Rent due day"), helperText, fullWidth = true, size, sx }) {
  const mode = DUE_MODES.some((m) => m.key === value?.mode) ? value.mode : "custom";
  const day = Math.min(Math.max(Math.round(Number(value?.day) || 5), 1), 31);
  const leaseDay = leaseStart ? resolveDueDay({ mode: "lease" }, leaseStart) : null;
  const optionText = (m) =>
    m.key === "lease"
      ? leaseDay
        ? t("Same date as the lease start (every {day})", { day: ordinalDay(leaseDay) })
        : leaseStart === undefined
        ? t("Same date as each tenant's lease start")
        : t(m.label)
      : m.key === "30"
      ? t("Every 30th of the month (last day in February)")
      : t(m.label);

  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: mode === "custom" ? { xs: "minmax(0, 1fr)", sm: "minmax(0, 1.6fr) minmax(0, 1fr)" } : "minmax(0, 1fr)", ...sx }}>
      <TextField select fullWidth={fullWidth} size={size} label={label} value={mode} onChange={(e) => onChange({ mode: e.target.value, day })} helperText={helperText}>
        {DUE_MODES.map((m) => (
          <MenuItem key={m.key} value={m.key}>
            {optionText(m)}
          </MenuItem>
        ))}
      </TextField>
      {mode === "custom" && (
        <TextField
          select
          fullWidth={fullWidth}
          size={size}
          label={t("Day of the month")}
          value={day}
          onChange={(e) => onChange({ mode: "custom", day: Number(e.target.value) })}
          helperText={day >= 29 ? t("Shorter months use their last day.") : " "}
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <MenuItem key={d} value={d}>
              {t("Every {day}", { day: ordinalDay(d) })}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Box>
  );
}
