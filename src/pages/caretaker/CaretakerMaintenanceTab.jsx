// Caretaker area · Repairs: requests to handle.
// Rendered by CaretakerDashboard.jsx, which owns the data and actions and passes them in.
import { Box, Button, Paper, Typography } from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HistoryIcon from "@mui/icons-material/History";
import { cardSx, LIST_PAGE, rise, EmptyState, FilterChips, RequestCard } from "./caretakerParts";
import { t } from "../../i18n";

export default function CaretakerMaintenanceTab({ activeTickets, archiveOpen, archiveShown, busyTicket, changeTicketStatus, highTickets, progressTickets, rankedTickets, resolvedTickets, setArchiveOpen, setArchiveShown, setTicketFilter, setTicketsShown, shownTickets, ticketFilter, ticketsShown }) {
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("Reports from residents, most urgent first. Update the status as you work on them.")}
      </Typography>
      {activeTickets.length > 0 && (
        <FilterChips
          value={ticketFilter}
          onChange={setTicketFilter}
          options={[
            { id: "open", label: t("Open"), n: activeTickets.length },
            { id: "high", label: t("High priority"), n: highTickets.length },
            { id: "progress", label: t("In progress"), n: progressTickets.length },
          ]}
        />
      )}
      {rankedTickets.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<BuildOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={t("No maintenance requests")} body={t("When a resident reports a problem it will show up here.")} />
        </Paper>
      ) : (
        <>
          {shownTickets.length === 0 ? (
            <Paper elevation={0} sx={cardSx}>
              <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={t("All sorted")} body={activeTickets.length === 0 ? "No open requests right now." : "Nothing in this filter."} />
            </Paper>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, sm: 2 } }}>
              {shownTickets.slice(0, ticketsShown).map((t, i) => (
                <Box key={t.id} sx={{ ...rise(Math.min(i, 5)), minWidth: 0 }}>
                  <RequestCard t={t} busy={busyTicket === t.id} onStatus={changeTicketStatus} />
                </Box>
              ))}
            </Box>
          )}
          {shownTickets.length > LIST_PAGE && (
            <Box sx={{ textAlign: "center", mt: 1.5 }}>
              <Button size="small" onClick={() => setTicketsShown((n) => (n >= shownTickets.length ? LIST_PAGE : n + LIST_PAGE))} sx={{ fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.5, textTransform: "none" }}>
                {ticketsShown >= shownTickets.length ? t("Show fewer") : `Show ${Math.min(LIST_PAGE, shownTickets.length - ticketsShown)} more requests`}
              </Button>
            </Box>
          )}

          {resolvedTickets.length > 0 && (
            <Box sx={{ mt: { xs: 2.5, sm: 3 } }}>
              <Button
                fullWidth
                onClick={() => setArchiveOpen((o) => !o)}
                aria-expanded={archiveOpen}
                startIcon={<HistoryIcon fontSize="small" />}
                endIcon={<ArrowForwardIcon fontSize="small" sx={{ transform: archiveOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }} />}
                sx={{ ...cardSx, justifyContent: "space-between", px: 2, minHeight: 52, fontWeight: 700, color: "text.primary", textTransform: "none" }}
              >
                <Box component="span" sx={{ flex: 1, textAlign: "left", ml: 0.5 }}>
                  {t("Archive ·")}{" "}{resolvedTickets.length}{" "}{t("closed")}
                </Box>
              </Button>
              {archiveOpen && (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, sm: 2 }, mt: 1.5 }}>
                  {resolvedTickets.slice(0, archiveShown).map((t) => (
                    <Box key={t.id} sx={{ minWidth: 0, opacity: 0.85 }}>
                      <RequestCard t={t} busy={busyTicket === t.id} onStatus={changeTicketStatus} compact />
                    </Box>
                  ))}
                </Box>
              )}
              {archiveOpen && resolvedTickets.length > LIST_PAGE && (
                <Box sx={{ textAlign: "center", mt: 1.5 }}>
                  <Button size="small" onClick={() => setArchiveShown((n) => (n >= resolvedTickets.length ? LIST_PAGE : n + LIST_PAGE))} sx={{ fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.5, textTransform: "none" }}>
                    {archiveShown >= resolvedTickets.length ? t("Show fewer") : `Show ${Math.min(LIST_PAGE, resolvedTickets.length - archiveShown)} more`}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </>
  );
}
