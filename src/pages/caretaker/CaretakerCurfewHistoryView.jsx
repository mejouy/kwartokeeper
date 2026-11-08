// Caretaker area · Tenants: past curfew nights.
// Rendered by CaretakerDashboard.jsx, which owns the data and actions and passes them in.
import { Alert, Box, Button, Paper, Skeleton, Typography } from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import HistoryIcon from "@mui/icons-material/History";
import { row, cardSx, timeOf, NIGHT_PAGE, Pill, EmptyState } from "./caretakerParts";
import { t } from "../../i18n";

export default function CaretakerCurfewHistoryView({ historyLoading, loadHistory, nightsShown, openNight, setNightsShown, setOpenNight }) {
  return (
    <>
      <Box sx={{ ...row, justifyContent: "flex-end", mb: 1 }}>
        <Button size="small" startIcon={<RefreshOutlinedIcon />} onClick={loadHistory} disabled={historyLoading} sx={{ fontWeight: 700, textTransform: "none", minHeight: 40 }}>
          {t("Refresh")}
        </Button>
      </Box>
      {historyLoading && !history.loaded ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} variant="rounded" height={72} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      ) : history.error ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          {t("Past nights couldn't be loaded. Check your connection and tap Refresh.")}
        </Alert>
      ) : history.nights.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<HistoryIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={t("No curfew records yet")} body={t("Nights you record in the Curfew check tab will show up here.")} />
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gap: 1 }}>
          {history.nights.slice(0, nightsShown).map((n) => {
            const list = Object.entries(n.entries || {}).map(([id, e]) => ({ id, ...e }));
            const count = (k) => list.filter((e) => e.status === k).length;
            const flagged = list.filter((e) => e.status === "out" || e.status === "late").sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true }));
            const open = openNight === n.key;
            const [yy, mm, dd] = n.key.split("-").map(Number);
            return (
              <Paper key={n.key} elevation={0} sx={{ ...cardSx, overflow: "hidden", borderColor: count("out") > 0 ? "error.main" : "divider" }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setOpenNight(open ? "" : n.key)}
                  aria-expanded={open}
                  sx={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", p: 1.5, display: "block", minHeight: 56, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}
                >
                  <Box sx={{ ...row, justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {n.curfewTime ? `Curfew ${n.curfewTime}` : t("No curfew")}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                    <Pill label={`${count("present")} in`} tone="success" />
                    {count("late") > 0 && <Pill label={`${count("late")} late`} tone="warning" />}
                    {count("out") > 0 && <Pill label={`${count("out")} out`} tone="error" />}
                  </Box>
                </Box>
                {open && (
                  <Box sx={{ px: 1.5, pb: 1.5, borderTop: "1px solid", borderColor: "divider", pt: 1 }}>
                    {flagged.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t("Everyone recorded was in on time.")}
                      </Typography>
                    ) : (
                      flagged.map((e) => (
                        <Box key={e.id} sx={{ ...row, justifyContent: "space-between", gap: 1, py: 0.75 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700 }} noWrap>
                              {e.name || t("Tenant")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                              {t("Room")}{" "}{e.roomNumber || "N/A"}
                              {timeOf(e.at) ? ` · ${timeOf(e.at)}` : ""}
                              {e.noticeSent ? t(" · notified") : ""}
                            </Typography>
                          </Box>
                          <Pill label={e.status === "out" ? "Out" : "Late"} tone={e.status === "out" ? "error" : "warning"} />
                        </Box>
                      ))
                    )}
                    {n.recordedByName && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        {t("Recorded by")}{" "}{n.recordedByName}
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
            );
          })}
          {history.nights.length > NIGHT_PAGE && (
            <Box sx={{ textAlign: "center", mt: 1 }}>
              <Button size="small" onClick={() => setNightsShown((n) => (n >= history.nights.length ? NIGHT_PAGE : n + NIGHT_PAGE))} sx={{ fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.5, textTransform: "none" }}>
                {nightsShown >= history.nights.length ? t("Show fewer nights") : `Show ${Math.min(NIGHT_PAGE, history.nights.length - nightsShown)} older nights`}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </>
  );
}
