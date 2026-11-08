// Tenant area · Repairs: report a problem and follow requests.
// Rendered by TenantDashboard.jsx, which owns the data and actions and passes them in.
import { Box, Button, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { PAGE_SIZE, row, cardSx, rise, EmptyState, TicketCard, ShowMore, FilterPills } from "./tenantParts";
import { t } from "../../i18n";

export default function TenantMaintenanceTab({ activeTickets, archiveOpen, archiveShown, isPhone, openRepair, openTicketDlg, rankedTickets, resolvedTickets, setArchiveOpen, setArchiveShown, setTicketFilter, setTicketsShown, shownTickets, ticketFilter, ticketsShown }) {
  return (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography variant="body2" color="text.secondary">
          {t("Report an issue in your room or unit and track its progress.")}
        </Typography>
        {!isPhone && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openRepair} sx={{ fontWeight: 700, borderRadius: 2.5, px: 2.5, flexShrink: 0 }}>
            {t("New request")}
          </Button>
        )}
      </Box>

      {rankedTickets.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState
            icon={<BuildOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
            title={t("No maintenance requests")}
            body={t("Something broken or needs fixing? Tap \"New request\" and your landlord will see it right away.")}
          />
        </Paper>
      ) : (
        <>
          {activeTickets.length === 0 ? (
            <Paper elevation={0} sx={{ ...cardSx }}>
              <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={t("All sorted")} body={t("No open requests right now.")} />
            </Paper>
          ) : (
            <>
              {activeTickets.length > 3 && (
                <FilterPills
                  value={ticketFilter}
                  onChange={(v) => {
                    setTicketFilter(v);
                    setTicketsShown(PAGE_SIZE);
                  }}
                  options={[
                    { id: "all", label: t("All open"), count: activeTickets.length },
                    { id: "Pending", label: t("Waiting"), count: activeTickets.filter((t) => (t.status || "Pending") === "Pending").length },
                    { id: "In Progress", label: t("Being fixed"), count: activeTickets.filter((t) => t.status === "In Progress").length },
                  ]}
                />
              )}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.25, sm: 1.5 }, alignItems: "start" }}>
                {shownTickets.slice(0, ticketsShown).map((t, i) => (
                  <Box key={t.id} sx={{ ...rise(Math.min(i, 5)), minWidth: 0 }}>
                    {/* A few requests: open in full. Many: short rows that open on tap */}
                    <TicketCard t={t} onAction={openTicketDlg} collapsible={activeTickets.length > 2} defaultOpen={activeTickets.length <= 2} />
                  </Box>
                ))}
              </Box>
              {shownTickets.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{t("No requests here.")}</Typography>
              )}
              <ShowMore
                shown={Math.min(ticketsShown, shownTickets.length)}
                total={shownTickets.length}
                step={PAGE_SIZE}
                noun={t("more requests")}
                onMore={() => setTicketsShown((n) => n + PAGE_SIZE)}
                onLess={() => setTicketsShown(PAGE_SIZE)}
              />
            </>
          )}

          {/* Resolved requests live in the archive, out of the way */}
          {resolvedTickets.length > 0 && (
            <Box sx={{ mt: { xs: 2.5, sm: 3 } }}>
              <Button
                fullWidth
                onClick={() => setArchiveOpen((o) => !o)}
                aria-expanded={archiveOpen}
                startIcon={<HistoryIcon fontSize="small" />}
                sx={{ ...cardSx, justifyContent: "space-between", px: 2, minHeight: 52, fontWeight: 700, color: "text.primary", textTransform: "none" }}
                endIcon={<ArrowForwardIcon fontSize="small" sx={{ transform: archiveOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }} />}
              >
                <Box component="span" sx={{ flex: 1, textAlign: "left", ml: 0.5 }}>
                  {t("Archive ·")}{" "}{resolvedTickets.length}{" "}{t("closed")}
                </Box>
              </Button>
              {archiveOpen && (
                <>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.25, sm: 1.5 }, mt: 1.5, alignItems: "start" }}>
                    {resolvedTickets.slice(0, archiveShown).map((t) => (
                      <Box key={t.id} sx={{ minWidth: 0, opacity: 0.85 }}>
                        <TicketCard t={t} collapsible defaultOpen={false} />
                      </Box>
                    ))}
                  </Box>
                  <ShowMore
                    shown={Math.min(archiveShown, resolvedTickets.length)}
                    total={resolvedTickets.length}
                    step={PAGE_SIZE}
                    noun="more"
                    onMore={() => setArchiveShown((n) => n + PAGE_SIZE)}
                    onLess={() => setArchiveShown(PAGE_SIZE)}
                  />
                </>
              )}
            </Box>
          )}
        </>
      )}
    </>
  );
}
