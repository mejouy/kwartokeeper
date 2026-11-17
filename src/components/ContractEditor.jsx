// The owner writes a property's rental contract (panel revisions, utils/contract.js).
// Tenants at the property read it with their own details filled in and agree in
// the app. Changing the text after saving asks every tenant to agree again.
import { useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField, Typography } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { CONTRACT_PLACEHOLDERS, MAX_CONTRACT_CHARS, STARTER_CONTRACT, contractValues, fillContract } from "../utils/contract";
import { t } from "../i18n";

const SAMPLE_TENANT = { name: "Juan Dela Cruz", roomNumber: "101", bedId: "Bed 1", monthlyRent: 3500, rentDueDay: 5, leaseStartDate: "2026-12-01", leaseEndDate: "2027-11-30" };

export default function ContractEditor({ value, onChange, property, rules = [], fieldSx }) {
  const [preview, setPreview] = useState(false);
  const c = { enabled: false, title: "", body: "", version: 0, ...(value || {}) };
  const set = (patch) => onChange({ ...c, ...patch });

  return (
    <Box>
      <FormControlLabel
        control={<Switch checked={c.enabled} onChange={(e) => set({ enabled: e.target.checked, ...(e.target.checked && !c.body.trim() ? { title: c.title || "Rental agreement", body: STARTER_CONTRACT } : {}) })} />}
        label={<Typography sx={{ fontWeight: 700 }}>{t("Ask tenants to read and agree to a contract")}</Typography>}
      />
      {c.enabled && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1.5 }}>
          <TextField fullWidth label={t("Title")} value={c.title} onChange={(e) => set({ title: e.target.value.slice(0, 80) })} sx={fieldSx} />
          <TextField
            fullWidth
            multiline
            minRows={8}
            maxRows={20}
            label={t("Contract")}
            value={c.body}
            onChange={(e) => set({ body: e.target.value.slice(0, MAX_CONTRACT_CHARS) })}
            helperText={t("{n}/{max} · Leave a blank line between paragraphs. The house rules above are added at the end.", { n: c.body.length, max: MAX_CONTRACT_CHARS })}
            sx={fieldSx}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              {t("Tap to add a detail that is filled in for each tenant:")}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {CONTRACT_PLACEHOLDERS.map((p) => (
                <Chip key={p.key} size="small" label={t(p.label)} onClick={() => set({ body: `${c.body}${c.body && !/\s$/.test(c.body) ? " " : ""}{${p.key}}` })} sx={{ fontWeight: 700 }} />
              ))}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />} onClick={() => setPreview(true)} sx={{ fontWeight: 700, textTransform: "none" }}>
              {t("Preview as a tenant")}
            </Button>
            <Button onClick={() => set({ body: STARTER_CONTRACT })} sx={{ fontWeight: 700, textTransform: "none" }}>
              {t("Start from the template")}
            </Button>
          </Box>
          {c.version > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t("Version {n}. Saving a changed contract makes it version {next}, and tenants are asked to agree again.", { n: c.version, next: c.version + 1 })}
            </Typography>
          )}
        </Box>
      )}

      <Dialog open={preview} onClose={() => setPreview(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: "20px", m: 2, width: "calc(100% - 32px)" } } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{c.title || t("Rental agreement")}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            {t("Shown with a sample tenant's details.")}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {fillContract(c.body, contractValues({ tenant: SAMPLE_TENANT, property }))}
          </Typography>
          {rules.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 800, mt: 2, mb: 0.5 }}>{t("House rules")}</Typography>
              {rules.map((r, i) => (
                <Typography key={i} variant="body2">
                  {i + 1}. {r}
                </Typography>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPreview(false)} sx={{ fontWeight: 700 }}>
            {t("Close")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
