// What one caretaker changed, newest first: cash recorded, curfew marks,
// repair updates, room edits, notices sent (services/activityLog.js).
// Entries can't be edited or deleted by anyone, caretakers included.
import { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { ACTIVITY_CATEGORIES } from "../../../services/activityLog";
import { t } from "../../../i18n";

const HEAD = '"Inter", sans-serif';
const PAGE = 25;
const ICONS = { payment: PaymentsOutlinedIcon, curfew: NightsStayOutlinedIcon, repair: BuildOutlinedIcon, rooms: MeetingRoomOutlinedIcon, notice: CampaignOutlinedIcon, account: KeyOutlinedIcon };

const toDate = (v) => (typeof v?.toDate === "function" ? v.toDate() : v ? new Date(v) : null);
const dayLabel = (d) => {
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
};

export default function CaretakerActivity({ ownerUid, caretakerId, panelSx }) {
  const [count, setCount] = useState(PAGE);
  const [state, setState] = useState({ key: "", entries: [], more: false, error: "" });
  const [category, setCategory] = useState("all");
  const key = `${ownerUid}|${caretakerId}|${count}`;

  useEffect(() => {
    if (!ownerUid || !caretakerId) return undefined;
    const base = [collection(db, "audit_logs"), where("ownerUid", "==", ownerUid), where("actorUid", "==", caretakerId)];
    const publish = (docs, more) =>
      setState({
        key,
        entries: docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })),
        more,
        error: "",
      });
    let unsubscribe = onSnapshot(
      query(...base, orderBy("at", "desc"), limit(count + 1)),
      (snap) => publish(snap.docs.slice(0, count), snap.docs.length > count),
      (err) => {
        // Until the search index is deployed (firestore.indexes.json), read them all and sort here
        if (err?.code === "failed-precondition") {
          unsubscribe = onSnapshot(
            query(...base),
            (snap) => {
              const sorted = [...snap.docs].sort((a, b) => (toDate(b.data({ serverTimestamps: "estimate" }).at)?.getTime() || 0) - (toDate(a.data({ serverTimestamps: "estimate" }).at)?.getTime() || 0));
              publish(sorted.slice(0, count), sorted.length > count);
            },
            () => setState({ key, entries: [], more: false, error: "Couldn't load the activity." })
          );
          return;
        }
        console.warn("Activity unavailable:", err?.code || err);
        setState({ key, entries: [], more: false, error: "Couldn't load the activity." });
      }
    );
    return () => unsubscribe();
  }, [ownerUid, caretakerId, count, key]);

  const loading = state.key !== key && state.entries.length === 0;
  const shown = useMemo(() => (category === "all" ? state.entries : state.entries.filter((e) => e.category === category)), [state.entries, category]);
  const usedCategories = useMemo(() => Object.keys(ACTIVITY_CATEGORIES).filter((c) => state.entries.some((e) => e.category === c)), [state.entries]);

  // Group by day
  const groups = [];
  shown.forEach((e) => {
    const d = toDate(e.at);
    const label = d ? dayLabel(d) : "Just now";
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push({ ...e, date: d });
  });

  return (
    <Box sx={{ ...panelSx, p: { xs: 2, sm: 3 }, mt: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
          <HistoryOutlinedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.08rem" }}>{t("Activity")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("Everything they recorded or changed, newest first. Entries can't be edited or deleted.")}</Typography>
        </Box>
      </Box>

      {usedCategories.length > 1 && (
        <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 1.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {["all", ...usedCategories].map((c) => {
            const on = category === c;
            return (
              <Box
                key={c}
                component="button"
                type="button"
                aria-pressed={on}
                onClick={() => setCategory(c)}
                sx={{ flexShrink: 0, height: 36, px: 1.5, borderRadius: 99, font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "1px solid", borderColor: on ? "text.primary" : "divider", bgcolor: on ? "text.primary" : "background.default", color: on ? "background.default" : "text.secondary" }}
              >
                {c === "all" ? t("All") : ACTIVITY_CATEGORIES[c]}
              </Box>
            );
          })}
        </Box>
      )}

      {loading ? (
        <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      ) : state.error ? (
        <Typography variant="body2" color="error">{state.error}</Typography>
      ) : shown.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: "12px" }}>
          {category === "all" ? t("Nothing yet. Cash they record, curfew checks, repair updates, room changes and notices will show here.") : t("Nothing in this category yet.")}
        </Typography>
      ) : (
        <Box>
          {groups.map((g) => (
            <Box key={g.label} sx={{ "&:not(:first-of-type)": { mt: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }}>
                {g.label}
              </Typography>
              {g.items.map((e) => {
                const Icon = ICONS[e.category] || HistoryOutlinedIcon;
                return (
                  <Box key={e.id} sx={{ display: "flex", gap: 1.25, py: 1, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: "9px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: (t) => alpha(t.palette.text.primary, 0.05), color: "text.secondary", "& svg": { fontSize: 17 } }}>
                      <Icon />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{e.summary}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[e.date ? e.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "", ACTIVITY_CATEGORIES[e.category], e.propertyName].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
          {state.more && (
            <Button fullWidth onClick={() => setCount((c) => c + PAGE)} sx={{ mt: 1.5, fontWeight: 700, borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
              {t("Show older activity")}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
