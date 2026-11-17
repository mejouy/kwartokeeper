// Security deposits for one tenant (panel revisions: DP / move-in payments).
// A deposit is a one-time fee (type "deposit", utils/charges.js). While its
// month isn't paid it shows as "Not paid yet"; once paid the owner holds it,
// and when the tenant moves out the owner settles it: refunded, used for
// unpaid rent or fees, or kept for damages. `readOnly` is the tenant's view.
import { useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import { DEPOSIT_OUTCOMES, depositOutcomeLabel, isActiveCharge, round2, settleDeposit } from "../utils/charges";
import { billForMonth } from "../utils/tenantRent";
import { t } from "../i18n";

const row = { display: "flex", alignItems: "center" };
const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const TONE = { unpaid: "warning", held: "info", refunded: "success", applied: "default", forfeited: "error" };

/** Where one deposit stands: unpaid · held · refunded · applied · forfeited */
function depositState(deposit, { tenant, charges, payments }) {
  if (deposit.depositStatus) return deposit.depositStatus;
  const bill = billForMonth({ tenant, period: deposit.period, charges, payments });
  return bill.settled ? "held" : "unpaid";
}

const stateLabel = (state) =>
  ({ unpaid: t("Not paid yet"), held: t("Held by the owner"), refunded: t("Refunded"), applied: t("Used for unpaid rent or fees"), forfeited: t("Kept for damages") })[state] || state;

export function DepositPanel({ tenant, charges = [], payments = [], readOnly = false, embedded = true, onDone }) {
  const [settling, setSettling] = useState(null);
  const deposits = charges.filter((c) => c.type === "deposit" && isActiveCharge(c) && c.tenantId === (tenant?.id || tenant?.uid));
  if (deposits.length === 0) return null;

  return (
    <Box sx={embedded ? { mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" } : {}}>
      <Typography variant="body2" sx={{ ...row, gap: 0.75, fontWeight: 800, mb: 1 }}>
        <SavingsOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        {readOnly ? t("Your security deposit") : t("Security deposit")}
      </Typography>
      {deposits.map((d) => {
        const state = depositState(d, { tenant, charges, payments });
        return (
          <Box key={d.id} sx={{ ...row, flexWrap: "wrap", gap: 1, py: 1, borderTop: "1px solid", borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 800 }}>{peso(d.amount)}</Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: "anywhere" }}>
                {t("Billed {period}", { period: d.period })}
                {d.depositStatus === "refunded" && Number(d.depositAmountReturned) > 0 ? ` · ${t("{amount} returned", { amount: peso(d.depositAmountReturned) })}` : ""}
                {d.depositNote ? ` · ${d.depositNote}` : ""}
              </Typography>
            </Box>
            <Chip size="small" label={stateLabel(state)} sx={{ fontWeight: 700, bgcolor: (th) => (TONE[state] === "default" ? alpha(th.palette.text.primary, 0.07) : alpha(th.palette[TONE[state]].main, 0.13)), color: (th) => (TONE[state] === "default" ? th.palette.text.secondary : th.palette[TONE[state]].dark) }} />
            {!readOnly && state === "held" && (
              <Button size="small" variant="outlined" onClick={() => setSettling(d)} sx={{ fontWeight: 700, borderRadius: "10px" }}>
                {t("Settle deposit")}
              </Button>
            )}
          </Box>
        );
      })}
      {settling && <SettleDialog deposit={settling} onClose={() => setSettling(null)} onDone={onDone} />}
    </Box>
  );
}

function SettleDialog({ deposit, onClose, onDone }) {
  const [outcome, setOutcome] = useState("refunded");
  const [amount, setAmount] = useState(String(deposit.amount || ""));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const returned = outcome === "refunded" ? round2(amount) : 0;
    if (outcome === "refunded" && !(returned > 0 && returned <= Number(deposit.amount))) {
      setError(t("Enter how much was returned, up to {amount}.", { amount: peso(deposit.amount) }));
      return;
    }
    if (outcome !== "refunded" && !note.trim()) {
      setError(t("Say what the deposit was used for. The tenant sees this."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await settleDeposit(deposit.id, { outcome, amountReturned: returned, note });
      onDone?.(t("Deposit marked as {outcome}.", { outcome: depositOutcomeLabel(outcome).toLowerCase() }));
      onClose();
    } catch (err) {
      console.error("Couldn't settle the deposit:", err);
      setError(t("Couldn't save. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "20px", m: 2, width: "calc(100% - 32px)" } } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{t("Settle the deposit")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("{amount} deposit from {name}. Usually settled when the tenant moves out.", { amount: peso(deposit.amount), name: deposit.tenantName || t("the tenant") })}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
            {error}
          </Alert>
        )}
        <ToggleButtonGroup exclusive orientation="vertical" fullWidth value={outcome} onChange={(_, v) => {
            if (!v) return;
            setOutcome(v);
            setError("");
          }} sx={{ mb: 2, "& .MuiToggleButton-root": { justifyContent: "flex-start", fontWeight: 700, textTransform: "none", minHeight: 44 } }}>
          {DEPOSIT_OUTCOMES.map((o) => (
            <ToggleButton key={o.key} value={o.key}>
              {t(o.label)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {outcome === "refunded" && (
          <TextField fullWidth label={t("Amount returned")} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} sx={{ mb: 2 }} slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> }, htmlInput: { inputMode: "decimal" } }} />
        )}
        <TextField
          fullWidth
          multiline
          minRows={2}
          label={outcome === "refunded" ? t("Note (optional)") : t("What it was used for")}
          placeholder={outcome === "forfeited" ? t("e.g. broken cabinet door") : outcome === "applied" ? t("e.g. October rent balance") : t("e.g. returned in cash on move-out")}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          helperText={t("{n}/{max} · the tenant sees this", { n: note.length, max: 200 })}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={{ fontWeight: 700 }}>
          {t("Cancel")}
        </Button>
        <Button variant="contained" disableElevation onClick={save} disabled={busy} sx={{ fontWeight: 700, borderRadius: "10px", minWidth: 120 }}>
          {busy ? <CircularProgress size={20} color="inherit" /> : t("Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
