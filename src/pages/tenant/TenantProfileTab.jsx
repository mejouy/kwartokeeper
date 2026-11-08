// Tenant area · Profile: room, lease, house rules, curfew record and contacts.
// Rendered by TenantDashboard.jsx, which owns the data and actions and passes them in.
import { Avatar, Box, Button, LinearProgress, Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilePreviewDialog from "../../components/FilePreviewDialog";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { RULES_PREVIEW, row, cardSx, fmtDate, formatLeaseStart, initials, rise, Pill, Panel, Facts } from "./tenantParts";
import { t } from "../../i18n";
import LanguageSwitch from "../../components/LanguageSwitch";

export default function TenantProfileTab({ ackRules, hasCover, hasHouseRules, lease, previewFile, recentCurfew, rulesAcked, rulesOpen, setPreviewFile, setRulesOpen, statusTone, tenantInfo }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1.4fr)" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, minWidth: 0 }}>
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, sm: 3 }, textAlign: "center", ...rise(0) }}>
          <Avatar sx={{ width: 76, height: 76, mx: "auto", mb: 1.5, fontSize: "1.6rem", fontWeight: 800, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>
            {initials(tenantInfo.name)}
          </Avatar>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.3rem", mb: 1.5, overflowWrap: "anywhere" }}>{tenantInfo.name}</Typography>
          <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0.75 }}>
            <Pill label={t(tenantInfo.status)} tone={statusTone} />
            <Pill label={t("Room {room}", { room: tenantInfo.roomNumber })} icon={<HomeWorkOutlinedIcon />} />
          </Box>
          {/* Language for this phone (tenants can switch to Filipino) */}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, mb: 0.75, fontWeight: 700 }}>
            {t("Language")}
          </Typography>
          <LanguageSwitch />
        </Paper>

        <Panel title={t("Room & lease")} icon={<CalendarMonthOutlinedIcon fontSize="small" />} sx={rise(1)}>
          {lease && (
            <Box sx={{ mb: 1.5 }}>
              {lease.open ? (
                <Typography variant="body2" color="text.secondary">
                  {t("Your lease is open-ended. You've been here since")}{" "}<strong>{fmtDate(lease.startMs)}</strong>.
                </Typography>
              ) : (
                <>
                  <Box sx={{ ...row, justifyContent: "space-between", mb: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {Math.round(lease.progress * 100)}{t("% complete")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {lease.ended ? t("Ended") : `${lease.daysLeft} days left`}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={lease.progress * 100} sx={{ height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
                  <Box sx={{ ...row, justifyContent: "space-between", mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(lease.startMs)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(lease.endMs)}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          )}
          <Facts
            items={[
              { label: t("Room"), value: `Room ${tenantInfo.roomNumber}` },
              { label: t("Bed"), value: tenantInfo.bedId },
              { label: t("Lease start"), value: formatLeaseStart(tenantInfo.leaseStartDate) },
              { label: t("Lease length"), value: tenantInfo.leaseDuration },
              { label: t("My phone"), value: tenantInfo.contact },
            ]}
          />
        </Panel>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, minWidth: 0 }}>
        <Panel title={t("My place")} icon={<PlaceOutlinedIcon fontSize="small" />} sx={rise(2)}>
          {hasCover && (
            <Box component="img" src={tenantInfo.coverPhotoUrl} alt="" sx={{ display: "block", width: "100%", height: 140, objectFit: "cover", borderRadius: 2, mb: 1.5 }} />
          )}
          <Typography sx={{ fontWeight: 800 }}>{tenantInfo.propertyName}</Typography>
          {tenantInfo.propertyAddress && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {tenantInfo.propertyAddress}
            </Typography>
          )}
          {tenantInfo.amenities.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
              {tenantInfo.amenities.map((a) => (
                <Pill key={a} label={a} />
              ))}
            </Box>
          )}
          {tenantInfo.emergencyPhone && (
            <Button
              component="a"
              href={`tel:${tenantInfo.emergencyPhone}`}
              variant="outlined"
              color="error"
              fullWidth
              startIcon={<PhoneOutlinedIcon />}
              sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}
            >
              {t("Emergency:")}{" "}{tenantInfo.emergencyPhone}
            </Button>
          )}
        </Panel>

        <Panel title={t("House rules & curfew")} icon={<PolicyOutlinedIcon fontSize="small" />} sx={rise(3)}>
          {!hasHouseRules ? (
            <Typography variant="body2" color="text.secondary">
              {t("Your landlord hasn't posted any house rules yet.")}
            </Typography>
          ) : (
            <>
              {tenantInfo.curfewTime && (
                <Box sx={{ ...row, gap: 1.25, p: 1.5, mb: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}>
                  <ScheduleIcon color="primary" />
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>{t("Curfew at")}{" "}{tenantInfo.curfewTime}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("Please be back before then.")}
                    </Typography>
                  </Box>
                </Box>
              )}
              {tenantInfo.curfewTime && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    {t("YOUR CURFEW RECORD · LAST 30 NIGHTS")}
                  </Typography>
                  {recentCurfew.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t("Nothing recorded yet.")}
                    </Typography>
                  ) : (
                    <>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
                        <Pill label={`${recentCurfew.filter((r) => r.status === "present").length} on time`} tone="success" />
                        {recentCurfew.some((r) => r.status === "late") && <Pill label={`${recentCurfew.filter((r) => r.status === "late").length} late`} tone="warning" />}
                        {recentCurfew.some((r) => r.status === "out") && <Pill label={`${recentCurfew.filter((r) => r.status === "out").length} out past curfew`} tone="error" />}
                      </Box>
                      {recentCurfew.filter((r) => r.status !== "present").slice(0, 6).map((r) => {
                        const [yy, mm, dd] = String(r.date).split("-").map(Number);
                        return (
                          <Box key={r.id} sx={{ ...row, justifyContent: "space-between", gap: 1, mt: 0.75, py: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            </Typography>
                            <Pill label={r.status === "out" ? t("Out past curfew") : t("Late")} tone={r.status === "out" ? "error" : "warning"} />
                          </Box>
                        );
                      })}
                    </>
                  )}
                </Box>
              )}
              {tenantInfo.rules.length > 0 && (
                <>
                  <Box component="ol" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.9 }}>
                    {(rulesOpen ? tenantInfo.rules : tenantInfo.rules.slice(0, RULES_PREVIEW)).map((r, i) => (
                      <Typography component="li" variant="body2" key={`${i}-${r}`} sx={{ overflowWrap: "anywhere" }}>
                        {r}
                      </Typography>
                    ))}
                  </Box>
                  {tenantInfo.rules.length > RULES_PREVIEW && (
                    <Button
                      size="small"
                      onClick={() => setRulesOpen((v) => !v)}
                      aria-expanded={rulesOpen}
                      endIcon={<ExpandMoreIcon sx={{ transform: rulesOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                      sx={{ mt: 1, minHeight: 40, fontWeight: 700, textTransform: "none" }}
                    >
                      {rulesOpen ? t("Show fewer rules") : `Show all ${tenantInfo.rules.length} rules`}
                    </Button>
                  )}
                </>
              )}
              {tenantInfo.ruleFiles.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: tenantInfo.rules.length > 0 ? 2 : 0 }}>
                  {tenantInfo.ruleFiles.map((f, i) => (
                    <Button
                      key={`${i}-${f.url}`}
                      onClick={() => setPreviewFile(f)}
                      variant="outlined"
                      startIcon={<DescriptionOutlinedIcon />}
                      sx={{ justifyContent: "flex-start", fontWeight: 700, borderRadius: 2.5, minHeight: 44, textTransform: "none" }}
                    >
                      {f.name || t("House rules document")}
                    </Button>
                  ))}
                </Box>
              )}
              {!rulesAcked && (
                <Button fullWidth variant="contained" onClick={ackRules} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
                  {t("I've read the rules")}
                </Button>
              )}
            </>
          )}
        </Panel>
        <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      </Box>
    </Box>
  );
}
