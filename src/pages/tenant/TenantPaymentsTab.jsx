// Tenant area · Payments: pay rent, what's due, payment history and receipts.
// Rendered by TenantDashboard.jsx, which owns the data and actions and passes them in.
import { Alert, Box, Button, Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { ADVANCE_MONTHS, row, cardSx, peso, paymentTone, rise, StepTrack, Pill, Panel, EmptyState, FilterPills, PaymentYear } from "./tenantParts";
import { t } from "../../i18n";

export default function TenantPaymentsTab({ canPay, canPayAhead, currentBill, currentPeriod, currentPeriodPayment, currentStep, daysToDue, dueDateLabel, dueNow, dueText, filteredPayments, isAwaitingVerification, isPaid, isPhone, lease, openMonths, openPayRentModal, paidThisYear, payableMonths, paymentCounts, paymentFilter, payments, paymentsByYear, rentMissing, rentStatus, setPaymentFilter, setReceipt, statusKey }) {
  return (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography variant="body2" color="text.secondary">
          {t("Pay your rent and submit it for owner verification.")}
        </Typography>
        {!isPhone && (
          <Button variant="contained" startIcon={<PaymentIcon />} onClick={() => openPayRentModal()} disabled={!canPay && !canPayAhead} sx={{ fontWeight: 700, borderRadius: 2.5, px: 2.5, flexShrink: 0 }}>
            {canPay ? t("Pay rent") : canPayAhead ? t("Pay ahead") : isPaid ? t("Paid") : t("Awaiting verification")}
          </Button>
        )}
      </Box>

      {rentMissing && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {t("Your monthly rent isn't set yet, so the amount may need to be typed in. Ask your landlord to confirm it.")}
        </Alert>
      )}

      <Paper elevation={0} sx={{ ...cardSx, overflow: "hidden", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, mb: { xs: 2, sm: 2.5 }, ...rise(0) }}>
        {[
          { label: t("Billing period"), value: currentPeriod },
          { label: isPaid ? t("Amount paid") : t("Amount due"), value: peso(isPaid ? currentBill.total : dueNow), sub: currentBill.fees.length ? t("Includes {amount} fees", { amount: peso(currentBill.feeTotal) }) : undefined },
          { label: t("Due date"), value: dueDateLabel, sub: dueText },
          { label: t("Status"), value: t(rentStatus), tone: paymentTone(rentStatus) },
        ].map((item, i) => (
          <Box
            key={item.label}
            sx={{
              px: { xs: 1.75, sm: 2.5 },
              py: { xs: 1.25, sm: 1.75 },
              minWidth: 0,
              borderTop: { xs: i > 1 ? "1px solid" : "none", md: "none" },
              borderLeft: { xs: i % 2 === 1 ? "1px solid" : "none", md: i === 0 ? "none" : "1px solid" },
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
              {item.label}
            </Typography>
            {item.tone ? (
              <Box sx={{ mt: 0.5 }}>
                <Pill label={item.value} tone={item.tone} />
              </Box>
            ) : (
              <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.25rem" }, lineHeight: 1.3 }}>{item.value}</Typography>
            )}
            {item.sub && (
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {item.sub}
              </Typography>
            )}
          </Box>
        ))}
      </Paper>

      {/* Where is this month's payment? */}
      {currentPeriodPayment ? (
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 2.5 }, mb: { xs: 2, sm: 2.5 }, ...rise(1) }}>
          <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>{t("Your")}{" "}{currentPeriod}{" "}{t("payment")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {peso(currentPeriodPayment.amount)} · {currentPeriodPayment.paymentMethod}
            </Typography>
          </Box>
          <Box sx={{ px: { xs: 0, sm: 4 } }}>
            <StepTrack
              steps={[t("Submitted"), t("Under review"), statusKey === "rejected" ? t("Rejected") : t("Paid")]}
              current={currentStep}
              complete={isPaid}
              failed={statusKey === "rejected"}
            />
          </Box>
          {statusKey === "rejected" && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              {t("The owner couldn't verify this payment")}
              {currentPeriodPayment.rejectionReason ? `: ${currentPeriodPayment.rejectionReason}` : "."}{" "}{t("Check the details and submit it again.")}
            </Alert>
          )}
          {isAwaitingVerification && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t("The owner has been notified and will verify your payment soon.")}
            </Typography>
          )}
        </Paper>
      ) : (
        <Paper
          elevation={0}
          sx={{
            ...cardSx,
            p: { xs: 2, sm: 2.5 },
            mb: { xs: 2, sm: 2.5 },
            borderColor: (t) => alpha(t.palette[daysToDue < 0 ? "error" : "warning"].main, 0.45),
            bgcolor: (t) => alpha(t.palette[daysToDue < 0 ? "error" : "warning"].main, 0.06),
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            gap: 2,
            ...rise(1),
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>{daysToDue < 0 ? t("Your rent is overdue") : t("Rent not paid yet")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {peso(dueNow)}{" "}{t("for")}{" "}{currentPeriod} · {dueText.toLowerCase()}
            </Typography>
          </Box>
          {isPhone && (
            <Button variant="contained" startIcon={<PaymentIcon />} onClick={openPayRentModal} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
              {t("Pay now")}
            </Button>
          )}
        </Paper>
      )}

      {/* Coming months: what's covered, and paying ahead */}
      {payableMonths.length > 1 && (
        <Panel
          title={t("Coming months")}
          icon={<CalendarMonthOutlinedIcon fontSize="small" />}
          sx={{ mb: { xs: 2, sm: 2.5 }, ...rise(2) }}
          action={
            openMonths.some((m) => !m.current) && (
              <Button size="small" variant="outlined" startIcon={<PaymentIcon />} onClick={() => openPayRentModal(openMonths.filter((m) => !m.current || canPay).slice(0, 2).map((m) => m.label))} sx={{ fontWeight: 700, borderRadius: 2.5, minHeight: 40, flexShrink: 0 }}>
                {t("Pay ahead")}
              </Button>
            )
          }
        >
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "repeat(6, minmax(0, 1fr))" }, gap: 0.75 }}>
            {payableMonths.map((m) => {
              const tone = m.status === "paid" ? "success" : m.status === "pending" ? "warning" : m.current && !canPay ? "warning" : null;
              return (
                <Box key={m.label} sx={{ p: 1.25, borderRadius: 2, textAlign: "center", border: "1px solid", borderColor: tone ? (t) => alpha(t.palette[tone].main, 0.4) : "divider", bgcolor: tone ? (t) => alpha(t.palette[tone].main, 0.07) : "transparent" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{m.short}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: tone ? `${tone}.dark` : "text.secondary" }}>
                    {m.status === "paid" ? t("Paid") : m.status === "pending" ? t("Being checked") : m.status === "partial" ? t("Part paid") : m.current ? t("Due") : t("Not yet")}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
            {t("You can pay up to")}{" "}{ADVANCE_MONTHS}{" "}{t("months ahead")}{lease && !lease.open ? t(", until your lease ends") : ""}{t(". Each month is checked by your owner.")}
          </Typography>
        </Panel>
      )}

      <Panel
        title={t("Payment history")}
        icon={<HistoryIcon fontSize="small" />}
        sx={rise(2)}
        action={paidThisYear > 0 && <Pill label={`${peso(paidThisYear)} paid in ${new Date().getFullYear()}`} tone="success" />}
      >
        {payments.length > 0 && (
          <FilterPills
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[
              { id: "all", label: t("All"), count: paymentCounts.all },
              { id: "paid", label: t("Paid"), count: paymentCounts.paid },
              { id: "pending", label: t("Pending"), count: paymentCounts.pending },
              ...(paymentCounts.rejected > 0 ? [{ id: "rejected", label: t("Rejected"), count: paymentCounts.rejected }] : []),
            ]}
          />
        )}
        {payments.length === 0 ? (
          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={t("No payments yet")} body={t("Your submitted payments will show up here.")} />
        ) : filteredPayments.length === 0 ? (
          <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={t("Nothing here")} body={t("No payments match this filter.")} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {/* Latest year open, older years folded up */}
            {paymentsByYear.map(([year, list], i) => (
              <PaymentYear key={`${paymentFilter}-${year}`} year={year} list={list} defaultOpen={i === 0} onPick={setReceipt} />
            ))}
          </Box>
        )}
      </Panel>
    </>
  );
}
