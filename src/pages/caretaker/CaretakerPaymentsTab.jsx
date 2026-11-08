// Caretaker area · Payments: who has paid this month, cash recording.
// Rendered by CaretakerDashboard.jsx, which owns the data and actions and passes them in.
import { Box, Button, Paper, Typography } from "@mui/material";
import PaymentIcon from "@mui/icons-material/Payment";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import HistoryIcon from "@mui/icons-material/History";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { row, cardSx, peso, LIST_PAGE, Pill, Panel, EmptyState, StatTile, FilterChips, PayRow } from "./caretakerParts";
// Translation is "tr" here: this file also uses "t" for tenants and the theme
import { t as tr } from "../../i18n";

export default function CaretakerPaymentsTab({ billOf, collected, currentPeriod, isPhone, openCash, paidCount, payCounts, payFilter, payLimit, payments, pendingCount, rentState, rentTenants, setPayFilter, setPayLimit, setUnpaidShown, shownPayments, unpaidShown, unpaidTenants }) {
  return (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {tr("Rent for")}{" "}{currentPeriod}{tr(", and every payment on record.")}
        </Typography>
        {!isPhone && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCash()} sx={{ fontWeight: 700, borderRadius: 2.5, px: 2.5, flexShrink: 0, textTransform: "none" }}>
            {tr("Record cash payment")}
          </Button>
        )}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.25, md: 2 }, mb: { xs: 2, sm: 3 } }}>
        <StatTile title={tr("Collected")} value={peso(collected)} subtitle={currentPeriod} icon={<PaymentsOutlinedIcon fontSize="small" />} />
        <StatTile title={tr("Paid")} value={`${paidCount}/${rentTenants.length}`} subtitle={tr("Tenants this month")} icon={<CheckCircleOutlinedIcon fontSize="small" />} />
        <StatTile title={tr("Verifying")} value={pendingCount} subtitle={tr("Waiting for the owner")} icon={<HistoryIcon fontSize="small" />} />
        <StatTile title={tr("Unpaid")} value={unpaidTenants.length} subtitle={tr("Still to collect")} tone={unpaidTenants.length > 0 ? "error" : undefined} icon={<WarningAmberOutlinedIcon fontSize="small" />} />
      </Box>

      <Panel title={tr("Unpaid this month")} icon={<WarningAmberOutlinedIcon fontSize="small" />} sx={{ mb: { xs: 2, sm: 3 } }}>
        {unpaidTenants.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {tr("Everyone with a room has paid or is waiting for verification.")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {unpaidTenants.slice(0, unpaidShown).map((t) => (
              <Box key={t.id} sx={{ ...row, gap: 1.25, p: 1.25, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                    {t.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {tr("Room")}{" "}{t.roomNumber}
                    {(() => {
                      const bill = billOf(t, currentPeriod);
                      if (!bill.total) return "";
                      const fees = bill.feeTotal > 0 ? ` (incl. ${peso(bill.feeTotal)} fees)` : "";
                      return rentState[t.id] === "partial" ? ` · ${peso(bill.balance)} left of ${peso(bill.total)}${fees}` : ` · ${peso(bill.total)}${fees}`;
                    })()}
                    {rentState[t.id] === "rejected" ? tr(" · last payment rejected") : ""}
                  </Typography>
                </Box>
                {rentState[t.id] === "partial" && <Pill label={tr("Partial")} tone="warning" sx={{ flexShrink: 0, display: { xs: "none", sm: "inline-flex" } }} />}
                <Button size="small" variant="outlined" onClick={() => openCash(t.id)} sx={{ fontWeight: 700, borderRadius: 2, minHeight: 40, flexShrink: 0, textTransform: "none" }}>
                  {tr("Record cash")}
                </Button>
              </Box>
            ))}
            {unpaidTenants.length > LIST_PAGE && (
              <Button size="small" onClick={() => setUnpaidShown((n) => (n >= unpaidTenants.length ? LIST_PAGE : n + LIST_PAGE))} sx={{ alignSelf: "center", fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.5, textTransform: "none" }}>
                {unpaidShown >= unpaidTenants.length ? tr("Show fewer") : `Show ${Math.min(LIST_PAGE, unpaidTenants.length - unpaidShown)} more`}
              </Button>
            )}
          </Box>
        )}
      </Panel>

      <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem", mb: 1.5 }}>
        {tr("Payment history")}
      </Typography>
      {payments.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<PaymentIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={tr("No payments yet")} body={tr("Payments from tenants and cash you record will appear here.")} />
        </Paper>
      ) : (
        <>
          <FilterChips
            value={payFilter}
            onChange={(v) => {
              setPayFilter(v);
              setPayLimit(20);
            }}
            options={[
              { id: "all", label: tr("All"), n: payCounts.all },
              { id: "paid", label: tr("Paid"), n: payCounts.paid },
              ...(payCounts.partial > 0 ? [{ id: "partial", label: tr("Partial"), n: payCounts.partial }] : []),
              { id: "pending", label: tr("Pending"), n: payCounts.pending },
              ...(payCounts.rejected > 0 ? [{ id: "rejected", label: tr("Rejected"), n: payCounts.rejected }] : []),
            ]}
          />
          {shownPayments.length === 0 ? (
            <Paper elevation={0} sx={cardSx}>
              <EmptyState icon={<PaymentIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={tr("Nothing here")} body={tr("No payments match this filter.")} />
            </Paper>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
              {shownPayments.slice(0, payLimit).map((p) => (
                <PayRow key={p.id} p={p} />
              ))}
            </Box>
          )}
          {shownPayments.length > payLimit && (
            <Box sx={{ textAlign: "center", mt: 1.5 }}>
              <Button size="small" onClick={() => setPayLimit((n) => n + 20)} sx={{ fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.5, textTransform: "none" }}>
                {tr("Show")}{" "}{Math.min(20, shownPayments.length - payLimit)}{" "}{tr("more")}
              </Button>
            </Box>
          )}
        </>
      )}
    </>
  );
}
