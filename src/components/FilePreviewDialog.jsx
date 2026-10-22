// src/components/FilePreviewDialog.jsx
//
// Read an uploaded house-rules file (PDF, Word, image) inside the app instead
// of downloading it. Images are shown directly; PDF/Word go through Google's
// document viewer, which works on phones (a plain <iframe> on a PDF does not).
// The file must be publicly reachable by URL (Cloudinary uploads are).

import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const isImage = (f) => /^image\//i.test(f?.type || "") || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(f?.url || "");

export default function FilePreviewDialog({ file, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  // Remember WHICH file finished loading / is slow, so opening another file starts fresh
  const fileKey = file?.url || "";
  const [loadedKey, setLoadedKey] = useState("");
  const [slowKey, setSlowKey] = useState("");
  const loaded = Boolean(fileKey) && loadedKey === fileKey;
  const slow = Boolean(fileKey) && slowKey === fileKey;

  useEffect(() => {
    if (!fileKey) return undefined;
    const t = setTimeout(() => setSlowKey(fileKey), 8000);
    return () => clearTimeout(t);
  }, [fileKey]);

  if (!file) return null;
  const image = isImage(file);
  const ext = ((file.name || "").match(/\.(\w+)$/)?.[1] || (file.url || "").split("?")[0].match(/\.(\w+)$/)?.[1] || "").toLowerCase();
  const word = ["doc", "docx", "dot", "dotx", "odt", "rtf"].includes(ext) || /word|officedocument/i.test(file.type || "");
  // Google's viewer refuses to be framed, so: Microsoft's viewer for Word files,
  // Mozilla's PDF.js viewer for everything else (PDFs).
  const src = image
    ? file.url
    : word
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`
    : `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file.url)}`;

  return (
    <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
        <Typography component="span" sx={{ fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file.name || "House rules document"}
        </Typography>
        <IconButton onClick={onClose} aria-label="Close preview" sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, position: "relative", height: fullScreen ? "auto" : "70vh", minHeight: 320, bgcolor: "action.hover" }}>
        {!loaded && (
          <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5, p: 3, textAlign: "center" }}>
            <CircularProgress size={28} />
            {slow && (
              <Typography variant="body2" color="text.secondary">
                Taking long? Some files can't be previewed — use “Open / download” below.
              </Typography>
            )}
          </Box>
        )}
        {image ? (
          <Box component="img" src={src} alt={file.name || "Document"} onLoad={() => setLoadedKey(fileKey)} sx={{ display: "block", width: "100%", height: "auto", position: "relative" }} />
        ) : (
          <Box component="iframe" title={file.name || "Document preview"} src={src} onLoad={() => setLoadedKey(fileKey)} sx={{ border: 0, width: "100%", height: "100%", minHeight: fullScreen ? "calc(100dvh - 140px)" : 320, position: "relative" }} />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.25 }}>
        <Button component="a" href={file.url} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewIcon />} sx={{ minHeight: 44, fontWeight: 700, textTransform: "none" }}>
          Open / download
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="contained" sx={{ minHeight: 44, fontWeight: 700, borderRadius: 2.5 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}