// Lists that grow over time (caretaker logs, payment history, a repair's
// updates) stay short: with FOLD_AT (5) or more items only the first few show,
// plus a "Show all N" toggle. Shorter lists show everything, no toggle.
import { useState } from "react";
import { Box, Button } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { t } from "../i18n";

export const FOLD_AT = 5;

/**
 * items: the full list. render(item, index) draws one. `preview` is how many
 * show while folded (default 3). `newestLast` folds from the end instead (the
 * last items show), for lists in time order like a repair's updates.
 */
export default function FoldList({ items = [], render, preview = 3, newestLast = false, gap = 1, noun, sx }) {
  const [open, setOpen] = useState(false);
  const folds = items.length >= FOLD_AT;
  const shown = !folds || open ? items : newestLast ? items.slice(-preview) : items.slice(0, preview);
  const offset = !folds || open || !newestLast ? 0 : items.length - shown.length;
  const hidden = items.length - shown.length;
  const toggle = folds && (
    <Button
      size="small"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      endIcon={<ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
      sx={{ alignSelf: "flex-start", fontWeight: 700, textTransform: "none", borderRadius: 99, minHeight: 34, px: 1.25, ml: -0.5 }}
    >
      {open ? t("Show fewer") : noun ? t("Show all {n} {noun}", { n: items.length, noun }) : t("Show {n} more", { n: hidden })}
    </Button>
  );
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap, ...sx }}>
      {newestLast && toggle}
      {shown.map((item, i) => render(item, i + offset))}
      {!newestLast && toggle}
    </Box>
  );
}
