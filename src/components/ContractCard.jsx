// A tenant's rental contract (panel revisions, utils/contract.js).
//  - Tenant: read it with their details filled in, type their name and agree;
//    download it as a PDF.
//  - Owner (readOnly): see whether and when the tenant agreed; download it.
import { useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { agreementStatus, contractOf, contractValues, downloadContractPdf, fillContract, houseRulesOf, longDate } from "../utils/contract";
import { t } from "../i18n";

const TONE = { pending: "warning", outdated: "warning", agreed: "success" };

export default function ContractCard({ tenant, property, ownerName = "", readOnly = false, onDone }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const contract = contractOf(property);
  if (!contract) return null;

  const status = agreementStatus(property, tenant);
  const text = fillContract(contract.body, contractValues({ tenant, property, ownerName }));
  const rules = houseRulesOf(property);
  const agreement = status === "agreed" || status === "outdated" ? tenant.contractAgreement : null;
  const label = { pending: t("Not agreed yet"), outdated: t("Updated, needs agreeing again"), agreed: t("Agreed") }[status];

  const download = async () => {
    try {
      await downloadContractPdf({ title: contract.title || "Rental agreement", text, rules, agreement: status === "agreed" ? agreement : null, fileName: `contract-${String(tenant.name || "tenant").replace(/[^\w-]+/g, "-")}.pdf` });
    } catch (err) {
      console.error("Couldn't make the PDF:", err);
      onDone?.(t("Couldn't make the PDF. Please try again."), "error");
    }
  };

  const agree = async () => {
    const typed = name.trim();
    if (!checked || typed.length < 2) {
      setError(t("Tick the box and type your full name to agree."));
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setBusy(true);
    setError("");
    try {
      await updateDoc(doc(db, "users", uid), {
        contractAgreement: { propertyId: property.id, version: contract.version, title: contract.title || "Rental agreement", name: typed, agreedAt: serverTimestamp() },
      });
      if (tenant.ownerUid) {
        addDoc(collection(db, "notifications"), {
          userId: tenant.ownerUid,
          kind: "notice",
          category: "account",
          type: "success",
          title: "Contract agreed",
          message: `${tenant.name || "A tenant"} agreed to the rental contract (version ${contract.version}) for ${property.propertyName || "your property"}.`,
          createdBy: uid,
          createdByRole: "tenant",
          isRead: false,
          createdAt: new Date().toISOString(),
        }).catch((err) => console.warn("Owner not notified:", err?.code || err));
      }
      setOpen(false);
      onDone?.(t("Thank you. You agreed to the contract."));
    } catch (err) {
      console.error("Couldn't save the agreement:", err);
      setError(t("Couldn't save. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <GavelOutlinedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
        <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 0 }}>{contract.title || t("Rental agreement")}</Typography>
        <Chip size="small" label={label} sx={{ fontWeight: 700, bgcolor: (th) => alpha(th.palette[TONE[status]].main, 0.13), color: (th) => th.palette[TONE[status]].dark }} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {status === "agreed"
          ? t("Agreed by {name} on {date} (version {v}).", { name: agreement?.name || tenant.name || "", date: longDate(agreement?.agreedAt) || t("a recent date"), v: contract.version })
          : status === "outdated"
          ? readOnly
            ? t("They agreed to version {old}. The contract changed since, so they're asked to agree again.", { old: agreement?.version || 1 })
            : t("The contract changed since you agreed. Please read it again.")
          : readOnly
          ? t("They haven't agreed yet. They're asked to read it on their dashboard.")
          : t("Please read your rental contract and agree to it.")}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
        {!readOnly && (
          <Button variant={status === "agreed" ? "outlined" : "contained"} disableElevation onClick={() => setOpen(true)} sx={{ fontWeight: 700, borderRadius: 2.5, textTransform: "none" }}>
            {status === "agreed" ? t("Read the contract") : t("Read and agree")}
          </Button>
        )}
        <Button startIcon={<DownloadOutlinedIcon />} onClick={download} sx={{ fontWeight: 700, textTransform: "none" }}>
          {t("Download PDF")}
        </Button>
      </Box>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm" scroll="paper" slotProps={{ paper: { sx: { borderRadius: 3, bgcolor: "background.default", m: 2, width: "calc(100% - 32px)" } } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{contract.title || t("Rental agreement")}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {text}
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
          {status !== "agreed" && (
            <Box sx={{ mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: (th) => alpha(th.palette.primary.main, 0.05) }}>
              {error && (
                <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}
              <FormControlLabel
                control={<Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />}
                label={<Typography variant="body2">{t("I have read the contract and the house rules, and I agree to them.")}</Typography>}
              />
              <TextField fullWidth size="small" label={t("Type your full name")} value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} sx={{ mt: 1 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} disabled={busy} sx={{ fontWeight: 700 }}>
            {t("Close")}
          </Button>
          {status !== "agreed" && (
            <Button variant="contained" disableElevation onClick={agree} disabled={busy || !checked || name.trim().length < 2} sx={{ fontWeight: 800, borderRadius: 2.5, px: 3 }}>
              {busy ? <CircularProgress size={20} color="inherit" /> : t("I agree")}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
