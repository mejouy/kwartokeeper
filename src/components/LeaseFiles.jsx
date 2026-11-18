// Pictures (or PDFs) of a tenant's signed lease contract. Optional.
//  - Owner, registering a tenant: LeaseFilesPicker picks files; they're
//    uploaded with the tenant (uploadLeaseFiles) and saved as tenant.leaseFiles.
//  - Owner, tenant profile: LeaseFilesCard with onChange adds or removes files
//    any time (a renewal is just new pictures; older ones can stay or go).
//  - Tenant, their dashboard: LeaseFilesCard read-only, so both sides see
//    the same signed copy.
// Saved shape: [{ url, name, type, uploadedAt (ISO) }], newest last.
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseIcon from "@mui/icons-material/Close";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import FilePreviewDialog from "./FilePreviewDialog";
import { MAX_LEASE_FILES, isPdfFile, isImageFile, leaseFileProblem, shortDate, uploadLeaseFiles } from "../utils/leaseFiles";
import { t } from "../i18n";

const ACCEPT = "image/*,application/pdf";

function Thumb({ file, src, onOpen, onRemove, removing, caption }) {
  const pdf = isPdfFile(file);
  return (
    <Box sx={{ position: "relative", minWidth: 0 }}>
      <Box
        component="button"
        type="button"
        onClick={onOpen}
        aria-label={t("Open {name}", { name: file.name || t("lease file") })}
        sx={{
          display: "block",
          width: "100%",
          aspectRatio: "3 / 4",
          p: 0,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "10px",
          overflow: "hidden",
          cursor: "pointer",
          bgcolor: (th) => alpha(th.palette.text.primary, 0.04),
          "&:hover": { borderColor: "primary.main" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
        {pdf ? (
          <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0.5, px: 1 }}>
            <PictureAsPdfOutlinedIcon sx={{ fontSize: 34, color: "error.main" }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", wordBreak: "break-word", textAlign: "center", lineHeight: 1.2 }}>
              {file.name || "PDF"}
            </Typography>
          </Box>
        ) : (
          <Box component="img" src={src || file.url} alt={file.name || t("Lease picture")} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
      </Box>
      {caption && (
        <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ mt: 0.5, textAlign: "center" }}>
          {caption}
        </Typography>
      )}
      {onRemove && (
        <Tooltip title={t("Remove")}>
          <span style={{ position: "absolute", top: 6, right: 6 }}>
            <IconButton
              size="small"
              onClick={onRemove}
              disabled={removing}
              aria-label={t("Remove {name}", { name: file.name || t("lease file") })}
              sx={{ bgcolor: "rgba(0,0,0,.6)", color: "#fff", width: 28, height: 28, "&:hover": { bgcolor: "rgba(0,0,0,.8)" } }}
            >
              {removing ? <CircularProgress size={14} color="inherit" /> : <CloseIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
}
// A picked (not yet uploaded) file, previewed from the phone/computer
function PickedThumb({ file, onRemove }) {
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);
  return <Thumb file={file} src={isImageFile(file) ? src : ""} onOpen={() => window.open(src, "_blank", "noopener")} onRemove={onRemove} />;
}

const gridSx = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1.25 };

/** Picking files while registering a tenant (nothing is uploaded until they save). */
export function LeaseFilesPicker({ files, onChange, disabled }) {
  const inputRef = useRef(null);
  const [problem, setProblem] = useState("");

  const add = (list) => {
    const picked = [...(list || [])];
    const bad = picked.map(leaseFileProblem).find(Boolean);
    const ok = picked.filter((f) => !leaseFileProblem(f));
    const room = MAX_LEASE_FILES - files.length;
    setProblem(bad || (ok.length > room ? t("Up to {n} files. The extra ones were left out.", { n: MAX_LEASE_FILES }) : ""));
    if (ok.length) onChange([...files, ...ok.slice(0, Math.max(room, 0))]);
  };

  return (
    <Box>
      {files.length > 0 && (
        <Box sx={{ ...gridSx, mb: 1.5 }}>
          {files.map((file, i) => (
            <PickedThumb key={`${file.name}-${file.size}-${i}`} file={file} onRemove={disabled ? undefined : () => onChange(files.filter((_, j) => j !== i))} />
          ))}
        </Box>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <Button
        variant="outlined"
        startIcon={<AddPhotoAlternateOutlinedIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || files.length >= MAX_LEASE_FILES}
        sx={{ fontWeight: 700, textTransform: "none", borderRadius: "10px", borderStyle: "dashed" }}
      >
        {files.length ? t("Add more pages") : t("Add contract pictures")}
      </Button>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
        {t("Optional. Photos or a PDF of the signed contract, up to {n} files. The tenant can see them too.", { n: MAX_LEASE_FILES })}
      </Typography>
      {problem && <Alert severity="warning" sx={{ mt: 1, py: 0, borderRadius: "10px" }}>{problem}</Alert>}
    </Box>
  );
}

/**
 * Saved lease files. With `onChange(nextFiles)` (owner) files can be added and
 * removed; it should save and may throw. Without it, read-only (tenant).
 */
export function LeaseFilesCard({ files = [], onChange, emptyText }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const editable = typeof onChange === "function";

  const add = async (list) => {
    const picked = [...(list || [])];
    const bad = picked.map(leaseFileProblem).find(Boolean);
    const ok = picked.filter((f) => !leaseFileProblem(f)).slice(0, Math.max(MAX_LEASE_FILES - files.length, 0));
    setProblem(bad || "");
    if (!ok.length) return;
    setBusy("add");
    try {
      const uploaded = await uploadLeaseFiles(ok);
      await onChange([...files, ...uploaded]);
    } catch (err) {
      console.error("Couldn't add the lease files:", err);
      setProblem(t("Couldn't upload. Check your connection and try again."));
    } finally {
      setBusy("");
    }
  };
  const remove = async (index) => {
    setBusy(`rm-${index}`);
    setProblem("");
    try {
      await onChange(files.filter((_, i) => i !== index));
    } catch (err) {
      console.error("Couldn't remove the lease file:", err);
      setProblem(t("Couldn't remove it. Check your connection and try again."));
    } finally {
      setBusy("");
    }
  };

  // Newest first, so a renewal's pages lead
  const shown = files.map((file, index) => ({ file, index })).reverse();

  return (
    <Box>
      {files.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: "10px" }}>
          {emptyText || (editable ? t("No contract pictures yet. Add photos of the signed contract so you both have a copy.") : t("Your landlord hasn't added pictures of your signed contract."))}
        </Typography>
      ) : (
        <Box sx={gridSx}>
          {shown.map(({ file, index }) => (
            <Thumb
              key={`${file.url}-${index}`}
              file={file}
              caption={shortDate(file.uploadedAt)}
              onOpen={() => setPreview({ url: file.url, name: file.name, type: file.type })}
              onRemove={editable ? () => remove(index) : undefined}
              removing={busy === `rm-${index}`}
            />
          ))}
        </Box>
      )}

      {editable && (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mt: 1.5 }}>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <Button
            variant="outlined"
            startIcon={busy === "add" ? <CircularProgress size={16} /> : <AddPhotoAlternateOutlinedIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(busy) || files.length >= MAX_LEASE_FILES}
            sx={{ fontWeight: 700, textTransform: "none", borderRadius: "10px" }}
          >
            {busy === "add" ? t("Uploading…") : files.length ? t("Add pages (e.g. a renewal)") : t("Add contract pictures")}
          </Button>
          {files.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t("{n} of {max} files · the tenant sees these too", { n: files.length, max: MAX_LEASE_FILES })}
            </Typography>
          )}
        </Box>
      )}
      {problem && <Alert severity="warning" sx={{ mt: 1, py: 0, borderRadius: "10px" }}>{problem}</Alert>}
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </Box>
  );
}
