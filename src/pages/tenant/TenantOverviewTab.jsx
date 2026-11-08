// Tenant area · Home: rent this month, what needs attention, lease, announcements.
// Rendered by TenantDashboard.jsx, which owns the data and actions and passes them in.
import { Box, Button, Chip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import PaymentIcon from "@mui/icons-material/Payment";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { PAGE_SIZE, ANNOUNCE_PREVIEW, ATTENTION_PREVIEW, row, peso, paymentTone, firstName, greeting, rise, LeaseWindows, Panel, TicketCard, ShowMore, FilterPills, AnnouncementItem, QuickAction, AttentionBanner } from "./tenantParts";
import { t } from "../../i18n";

export default function TenantOverviewTab({ activeTickets, aheadMonths, announcementFilter, announcements, announcementsShown, attention, attentionOpen, canPay, canPayAhead, currentBill, currentPeriod, dueDate, dueText, feesOutstanding, goTab, hasCover, heroBtnSx, isPaid, markRead, openPayRentModal, openRepair, rankedTickets, rentStatus, setAnnouncementFilter, setAnnouncementsShown, setAttentionOpen, setCoverFailed, statusTone, tenantInfo, unreadCount, visibleAnnouncements }) {
  return (
    <>
      {/* Hero: the property's cover photo gives the tenant a sense of home */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#202020",
          color: "#fff",
          borderRadius: 4,
          p: { xs: 2, sm: 4 },
          mb: { xs: 2, sm: 3 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "1.2fr 0.8fr" },
          gap: { xs: 2.5, md: 4 },
          alignItems: "end",
          minHeight: hasCover ? { xs: 300, sm: 280 } : undefined,
          ...rise(0),
        }}
      >
        {hasCover ? (
          <>
            <Box
              component="img"
              src={tenantInfo.coverPhotoUrl}
              alt=""
              onError={() => setCoverFailed(true)}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,20,20,0.35) 0%, rgba(20,20,20,0.88) 70%)" }} />
          </>
        ) : (
          <>
            <Box
              sx={{
                position: "absolute",
                top: -140,
                right: -100,
                width: 380,
                height: 380,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255, 69, 0, 0.22), transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <Box sx={{ position: "absolute", top: 20, right: 20, width: 150, opacity: 0.7, display: { xs: "none", sm: "block" }, pointerEvents: "none" }}>
              <LeaseWindows progress={0.5} />
            </Box>
          </>
        )}

        <Box sx={{ position: "relative", minWidth: 0, alignSelf: "end" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
            <Chip
              size="small"
              label={t("{status} tenant", { status: t(tenantInfo.status) })}
              sx={{
                fontWeight: 700,
                bgcolor: statusTone === "success" ? "rgba(76, 175, 80, 0.28)" : statusTone === "warning" ? "rgba(255, 167, 38, 0.28)" : "rgba(244, 67, 54, 0.28)",
                color: statusTone === "success" ? "#c8e6c9" : statusTone === "warning" ? "#ffe0b2" : "#ffcdd2",
              }}
            />
            {tenantInfo.curfewTime && (
              <Chip
                size="small"
                icon={<ScheduleIcon />}
                label={t("Curfew {time}", { time: tenantInfo.curfewTime })}
                sx={{ fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#fff", "& .MuiChip-icon": { color: "inherit" } }}
              />
            )}
          </Box>
          <Typography
            component="h1"
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: "#fff", fontSize: { xs: "1.45rem", sm: "2.1rem" }, lineHeight: 1.15, overflowWrap: "anywhere" }}
          >
            {greeting()}, {firstName(tenantInfo.name)}
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", mt: 0.75 }}>
            {tenantInfo.propertyName}{" "}{t("· Room")}{" "}{tenantInfo.roomNumber}
            {tenantInfo.bedId && tenantInfo.bedId !== "N/A" ? ` · ${t("Bed {bed}", { bed: tenantInfo.bedId })}` : ""}
          </Typography>
        </Box>

        {/* Rent card */}
        <Box
          sx={{
            position: "relative",
            p: { xs: 1.75, sm: 2.25 },
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <Box sx={{ ...row, justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>
              {t("{period} RENT", { period: currentPeriod.toUpperCase() })}
            </Typography>
            <Chip
              size="small"
              label={t(rentStatus)}
              sx={{
                fontWeight: 700,
                bgcolor: isPaid ? "rgba(76,175,80,0.3)" : paymentTone(rentStatus) === "error" ? "rgba(244,67,54,0.3)" : "rgba(255,167,38,0.3)",
                color: isPaid ? "#c8e6c9" : paymentTone(rentStatus) === "error" ? "#ffcdd2" : "#ffe0b2",
              }}
            />
          </Box>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: { xs: "1.8rem", sm: "2rem" }, lineHeight: 1.2 }}>{peso(feesOutstanding ? currentBill.balance : currentBill.total || tenantInfo.monthlyRent)}</Typography>
          {currentBill.fees.length > 0 && (
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
              {feesOutstanding ? t("Fees still due · ") : ""}{t("Rent")}{" "}{peso(currentBill.rent)} + {currentBill.fees.map((c) => `${c.label} ${peso(c.amount)}`).join(" + ")}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", mb: 1.75 }}>
            {dueText}
            {canPay ? ` · ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </Typography>
          {aheadMonths.length > 0 && (
            <Typography variant="caption" sx={{ display: "block", color: "#c8e6c9", fontWeight: 700, mt: -1, mb: 1.5 }}>
              {t("Also covered:")}{" "}{aheadMonths.map((m) => `${m.short}${m.status === "pending" ? " (sent)" : ""}`).join(", ")}
            </Typography>
          )}
          {canPay ? (
            <Button variant="contained" fullWidth size="large" startIcon={<PaymentIcon />} onClick={() => openPayRentModal()} sx={{ fontWeight: 800, borderRadius: 2.5, minHeight: 48 }}>
              {t("Pay rent")}
            </Button>
          ) : (
            canPayAhead ? (
              <Button fullWidth size="large" variant="outlined" startIcon={<PaymentIcon />} onClick={() => openPayRentModal()} sx={{ ...heroBtnSx, minHeight: 48 }}>
                {t("Pay next month early")}
              </Button>
            ) : (
              <Button fullWidth size="large" variant="outlined" onClick={() => goTab("payments")} sx={{ ...heroBtnSx, minHeight: 48 }}>
                {t("View payments")}
              </Button>
            )
          )}
        </Box>
      </Box>

      {/* Needs attention: the most urgent first, the rest one tap away */}
      {attention.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: { xs: 2, sm: 3 } }}>
          {(attentionOpen ? attention : attention.slice(0, ATTENTION_PREVIEW)).map(({ key, ...a }) => (
            <AttentionBanner key={key} {...a} />
          ))}
          {attention.length > ATTENTION_PREVIEW && (
            <Button
              onClick={() => setAttentionOpen((v) => !v)}
              aria-expanded={attentionOpen}
              color="inherit"
              endIcon={<ExpandMoreIcon sx={{ transform: attentionOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
              sx={{ alignSelf: "flex-start", fontWeight: 700, minHeight: 40, textTransform: "none", color: "text.secondary" }}
            >
              {attentionOpen ? t("Show fewer") : `${attention.length - ATTENTION_PREVIEW} more ${attention.length - ATTENTION_PREVIEW === 1 ? "thing" : "things"} to check`}
            </Button>
          )}
        </Box>
      )}

      {/* Quick actions */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: { xs: 0.75, sm: 1.5 }, mb: { xs: 2, sm: 3 }, ...rise(1) }}>
        <QuickAction
          icon={<PaymentIcon fontSize="small" />}
          label={canPay ? t("Pay rent") : canPayAhead ? t("Pay ahead") : t("Payments")}
          onClick={canPay || canPayAhead ? () => openPayRentModal() : () => goTab("payments")}
        />
        <QuickAction icon={<BuildOutlinedIcon fontSize="small" />} label={t("Report issue")} onClick={openRepair} badge={activeTickets.length} />
        <QuickAction icon={<PolicyOutlinedIcon fontSize="small" />} label={t("House rules")} onClick={() => goTab("profile")} />
      </Box>

      {/* Panels: what's happening now */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 3 }, alignItems: "stretch" }}>
        <Panel
          title={unreadCount > 0 ? t("Announcements · {n} new", { n: unreadCount }) : t("Announcements")}
          icon={<CampaignOutlinedIcon fontSize="small" />}
          sx={rise(2)}
          action={
            announcements.some((n) => n.isRead === false) && (
              <Button size="small" startIcon={<DoneAllIcon fontSize="small" />} onClick={() => markRead(announcements)} sx={{ fontWeight: 700, minHeight: 40, flexShrink: 0 }}>
                {t("Mark all read")}
              </Button>
            )
          }
        >
          {announcements.length === 0 ? (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", py: 3, gap: 1 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "rgba(255, 69, 0, 0.10)", color: "primary.main" }}>
                <CampaignOutlinedIcon />
              </Box>
              <Typography sx={{ fontWeight: 800 }}>{t("No announcements yet")}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
                {t("Updates from your landlord, like water interruptions or house meetings, show up here.")}
              </Typography>
            </Box>
          ) : (
            <>
              {unreadCount > 0 && announcements.length > ANNOUNCE_PREVIEW && (
                <FilterPills
                  value={announcementFilter}
                  onChange={(v) => {
                    setAnnouncementFilter(v);
                    setAnnouncementsShown(ANNOUNCE_PREVIEW);
                  }}
                  options={[
                    { id: "all", label: t("All"), count: announcements.length },
                    { id: "unread", label: t("Unread"), count: unreadCount },
                  ]}
                />
              )}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                {visibleAnnouncements.slice(0, announcementsShown).map((n) => (
                  <AnnouncementItem key={n.id} n={n} onRead={markRead} />
                ))}
                {visibleAnnouncements.length === 0 && (
                  <Typography variant="body2" color="text.secondary">{t("You're all caught up.")}</Typography>
                )}
              </Box>
              <ShowMore
                shown={Math.min(announcementsShown, visibleAnnouncements.length)}
                total={visibleAnnouncements.length}
                step={ANNOUNCE_PREVIEW}
                onMore={() => setAnnouncementsShown((n) => n + PAGE_SIZE)}
                onLess={() => setAnnouncementsShown(ANNOUNCE_PREVIEW)}
              />
            </>
          )}
        </Panel>

        <Panel
          title={activeTickets.length > 0 ? t("Open requests · {n}", { n: activeTickets.length }) : t("Open requests")}
          icon={<BuildOutlinedIcon fontSize="small" />}
          sx={rise(3)}
          action={
            rankedTickets.length > 0 && (
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => goTab("maintenance")} sx={{ fontWeight: 700, minHeight: 40, flexShrink: 0 }}>
                {activeTickets.length > 2 ? `All ${activeTickets.length}` : t("View all")}
              </Button>
            )
          }
        >
          {activeTickets.length === 0 ? (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", py: 3, gap: 1 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: (t) => alpha(t.palette.success.main, 0.12), color: "success.main" }}>
                <CheckCircleOutlinedIcon />
              </Box>
              <Typography sx={{ fontWeight: 800 }}>{t("Nothing needs fixing")}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
                {t("If something breaks in your room, report it and your landlord sees it right away.")}
              </Typography>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openRepair} sx={{ mt: 0.5, fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.75, textTransform: "none" }}>
                {t("Report an issue")}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {activeTickets.slice(0, 2).map((t) => (
                <TicketCard key={t.id} t={t} compact />
              ))}
            </Box>
          )}
        </Panel>
      </Box>
    </>
  );
}
