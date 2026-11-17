// Separate rates per bed in one room (panel revisions, utils/bedRates.js).
// Every bed starts at the room's rate; give a bed its own rate when it costs
// more or less (by the window, upper bunk...). Saving hands back the
// room's new bedRates; the page saves it with the property.
import { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField, Typography } from "@mui/material";
import { bedLabels, cleanBedRates } from "../utils/bedRates";
import { t } from "../i18n";

export default function BedRatesDialog({ room, onClose, onSave }) {
  const base = Number(room?.monthlyRatePerBed) || 0;
  const beds = bedLabels(room?.capacity);
  const [draft, setDraft] = useState(() => Object.fromEntries(beds.map((b) => [b, room?.bedRates?.[b] ? String(room.bedRates[b]) : ""])));

  const save = () => {
    onSave(cleanBedRates(Object.fromEntries(Object.entries(draft).map(([b, v]) => [b, Number(v) || 0])), room?.capacity, base));
    onClose();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "20px", m: 2, width: "calc(100% - 32px)" } } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{t("Bed rates · {room}", { room: room?.roomName || t("Room") })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("Every bed costs the room's rate of ₱{rate} unless you give it its own. New tenants are charged their bed's rate; current tenants keep theirs.", { rate: base.toLocaleString("en-PH") })}
        </Typography>
        {beds.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{t("Add beds to this room first.")}</Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
            {beds.map((b) => (
              <TextField
                key={b}
                size="small"
                label={b}
                placeholder={String(base)}
                value={draft[b]}
                onChange={(e) => setDraft((d) => ({ ...d, [b]: e.target.value.replace(/[^\d.]/g, "") }))}
                helperText={draft[b] && Number(draft[b]) !== base ? t("Own rate") : t("Room rate")}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={() => setDraft(Object.fromEntries(beds.map((b) => [b, ""])))} sx={{ fontWeight: 700, mr: "auto" }}>
          {t("All at room rate")}
        </Button>
        <Button onClick={onClose} sx={{ fontWeight: 700 }}>
          {t("Cancel")}
        </Button>
        <Button variant="contained" disableElevation onClick={save} sx={{ fontWeight: 700, borderRadius: "10px" }}>
          {t("Done")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
