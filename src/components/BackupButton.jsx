// "Download a backup" button with its result underneath (see utils/backup.js)
import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { t } from "../i18n";

const LABELS = {
  properties: "properties", tenants: "tenant records", people: "accounts", caretakers: "caretakers", payments: "payments",
  fees: "fees", repairs: "repair requests", curfewSheets: "curfew nights", users: "accounts", maintenance_tickets: "repair requests",
  charges: "fees", occupancy_logs: "curfew nights",
};

export default function BackupButton({ onDownload, label = "Download backup", note }) {
  const [state, setState] = useState({ busy: false, result: null, error: "" });

  const run = async () => {
    if (state.busy) return;
    setState({ busy: true, result: null, error: "" });
    try {
      setState({ busy: false, result: await onDownload(), error: "" });
    } catch (err) {
      console.error("Backup failed:", err);
      setState({ busy: false, result: null, error: "Couldn't make the backup. Check your connection and try again." });
    }
  };

  const counts = state.result?.counts || {};
  const shown = Object.entries(counts).filter(([k, n]) => LABELS[k] && n > 0).map(([k, n]) => `${n} ${LABELS[k]}`);

  return (
    <Box>
      {note && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {note}
        </Typography>
      )}
      <Button variant="outlined" startIcon={state.busy ? <CircularProgress size={16} /> : <DownloadOutlinedIcon />} onClick={run} disabled={state.busy} sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 44, width: { xs: "100%", sm: "auto" } }}>
        {state.busy ? t("Preparing…") : label}
      </Button>
      {state.error && <Alert severity="error" sx={{ mt: 1.5, borderRadius: "10px" }}>{state.error}</Alert>}
      {state.result && (
        <Alert severity={state.result.missing.length ? "warning" : "success"} sx={{ mt: 1.5, borderRadius: "10px" }}>
          {t("Downloaded")}{shown.length ? `: ${shown.join(", ")}` : ""}{t(". Keep the file somewhere safe, like your email or a cloud drive.")}
          {state.result.missing.length > 0 && ` Some parts couldn't be read (${state.result.missing.join(", ")}). Try again later for a complete copy.`}
        </Alert>
      )}
    </Box>
  );
}
