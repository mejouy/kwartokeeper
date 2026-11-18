// Caretaker area · Home: tonight's curfew, what needs attention, quick actions.
// Rendered by CaretakerDashboard.jsx, which owns the data and actions and passes them in.
import { Box, Button, Chip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilePreviewDialog from "../../components/FilePreviewDialog";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { RULES_PREVIEW, row, peso, firstName, greeting, rise, Pill, Panel, AttentionBanner, StatTile, QuickAction, RequestCard } from "./caretakerParts";
import { t } from "../../i18n";

export default function CaretakerOverviewTab({ activeTenants, activeTickets, address, amenities, attention, attentionOpen, bedsUsed, canFinancials, canOccupancy, canReports, canTenantsTab, checkCounts, checkTenants, checkedCount, collected, coverUrl, curfewPhase, curfewTime, currentPeriod, goTab, hasCover, hasHouseRules, highTickets, minsLabel, minsUntil, occupiedRooms, openCurfewCheck, openDirectory, paidCount, previewFile, profile, property, propertyName, quickActions, rentTenants, ruleFiles, rules, rulesOpen, setAttentionOpen, setCoverFailed, setPreviewFile, setRulesOpen, totalBeds, totalRooms, uncheckedCount }) {
  return (
    <>
      {/* Hero: the facility's cover photo */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#202020",
          color: "#fff",
          borderRadius: 4,
          p: { xs: 2, sm: 4 },
          mb: { xs: 2, sm: 3 },
          minHeight: { xs: 190, sm: 230 },
          display: "flex",
          alignItems: "flex-end",
          ...rise(0),
        }}
      >
        {hasCover ? (
          <>
            <Box component="img" src={coverUrl} alt="" onError={() => setCoverFailed(true)} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,20,20,0.3) 0%, rgba(20,20,20,0.88) 75%)" }} />
          </>
        ) : (
          <Box sx={{ position: "absolute", top: -140, right: -100, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(255, 69, 0, 0.22), transparent 70%)", pointerEvents: "none" }} />
        )}
        <Box sx={{ position: "relative", minWidth: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
            <Chip size="small" label={t("Caretaker")} sx={{ fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#fff" }} />
            {curfewTime && <Chip size="small" icon={<ScheduleIcon />} label={curfewPhase === "active" ? "Curfew in effect" : curfewPhase === "before" && minsUntil <= 120 ? `Curfew in ${minsLabel(minsUntil)}` : `Curfew ${curfewTime}`} sx={{ fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#fff", "& .MuiChip-icon": { color: "inherit" } }} />}
          </Box>
          <Typography component="h1" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: "#fff", fontSize: { xs: "1.45rem", sm: "2.1rem" }, lineHeight: 1.15, overflowWrap: "anywhere" }}>
            {greeting()}, {firstName(profile.name)}
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", mt: 0.75, overflowWrap: "anywhere" }}>
            {propertyName}
            {address ? ` · ${address}` : ""}
          </Typography>
        </Box>
      </Box>

      {attention.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: { xs: 2, sm: 3 } }}>
          {(attentionOpen ? attention : attention.slice(0, 2)).map(({ key, ...a }) => (
            <AttentionBanner key={key} {...a} />
          ))}
          {attention.length > 2 && (
            <Button
              onClick={() => setAttentionOpen((v) => !v)}
              color="inherit"
              aria-expanded={attentionOpen}
              endIcon={<ExpandMoreIcon sx={{ transform: attentionOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
              sx={{ alignSelf: "flex-start", fontWeight: 700, minHeight: 36, py: 0.5, px: 1.5, borderRadius: 99, textTransform: "none", color: "text.secondary" }}
            >
              {attentionOpen ? t("Show fewer") : `${attention.length - 2} more to check`}
            </Button>
          )}
        </Box>
      )}

      {/* The things a caretaker does most, one thumb-tap away */}
      {quickActions.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))`, gap: { xs: 1, sm: 1.5 }, mb: { xs: 2, sm: 3 }, ...rise(1) }}>
          {quickActions.map(({ key, ...q }) => (
            <QuickAction key={key} {...q} />
          ))}
        </Box>
      )}

      {/* Where things stand (tap a tile to open it) */}
      {(() => {
        const tiles = [
          { key: "beds", title: t("Beds filled"), value: `${bedsUsed}/${totalBeds}`, subtitle: `${occupiedRooms} of ${totalRooms} rooms in use`, icon: <MeetingRoomOutlinedIcon fontSize="small" />, onClick: canTenantsTab ? () => goTab("tenants") : undefined },
          { key: "residents", title: t("Residents"), value: activeTenants.length, subtitle: t("Active tenants"), icon: <PeopleAltOutlinedIcon fontSize="small" />, onClick: canTenantsTab ? openDirectory : undefined },
          canOccupancy &&
            curfewTime && {
              key: "tonight",
              title: t("Tonight"),
              value: `${checkedCount}/${checkTenants.length}`,
              subtitle: checkCounts.out > 0 ? `${checkCounts.out} out past curfew` : uncheckedCount > 0 ? `${uncheckedCount} not checked yet` : "Everyone checked",
              tone: checkCounts.out > 0 ? "error" : undefined,
              icon: <ScheduleIcon fontSize="small" />,
              onClick: openCurfewCheck,
            },
          canReports && {
            key: "requests",
            title: t("Open requests"),
            value: activeTickets.length,
            subtitle: highTickets.length ? `${highTickets.length} high priority` : "None urgent",
            tone: highTickets.length ? "error" : undefined,
            icon: <BuildOutlinedIcon fontSize="small" />,
            onClick: () => goTab("maintenance"),
          },
          canFinancials && { key: "rent", title: `${currentPeriod.split(" ")[0]} rent`, value: peso(collected), subtitle: `${paidCount} of ${rentTenants.length} paid`, icon: <PaymentIcon fontSize="small" />, onClick: () => goTab("payments") },
        ].filter(Boolean);
        return (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${Math.min(tiles.length, 5)}, minmax(0, 1fr))` },
              gap: { xs: 1.25, md: 2 },
              mb: { xs: 2, sm: 3 },
              ...rise(1),
              // An odd last tile spans the row on phones instead of leaving a hole
              ...(tiles.length % 2 === 1 ? { "& > :last-of-type": { gridColumn: { xs: "1 / -1", md: "auto" } } } : {}),
            }}
          >
            {tiles.map(({ key, ...t }) => (
              <StatTile key={key} {...t} />
            ))}
          </Box>
        );
      })()}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, minWidth: 0 }}>
          <Panel title={t("Property")} icon={<PlaceOutlinedIcon fontSize="small" />} sx={rise(2)}>
            <Typography sx={{ fontWeight: 800 }}>{propertyName}</Typography>
            {address && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {address}
              </Typography>
            )}
            {property.propertyType && (
              <Box sx={{ mt: 1 }}>
                <Pill label={String(property.propertyType)} icon={<HomeWorkOutlinedIcon />} />
              </Box>
            )}
            {amenities.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
                {amenities.map((a) => (
                  <Pill key={a} label={a} />
                ))}
              </Box>
            )}
            {property.emergencyPhone && (
              <Button component="a" href={`tel:${property.emergencyPhone}`} variant="outlined" color="error" fullWidth startIcon={<PhoneOutlinedIcon />} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
                {t("Emergency:")}{" "}{property.emergencyPhone}
              </Button>
            )}
          </Panel>

          {canReports && (
            <Panel
              title={t("Needs a look")}
              icon={<BuildOutlinedIcon fontSize="small" />}
              sx={rise(4)}
              action={
                activeTickets.length > 0 && (
                  <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => goTab("maintenance")} sx={{ fontWeight: 700, minHeight: 40 }}>
                    {t("View all")}
                  </Button>
                )
              }
            >
              {activeTickets.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("No open maintenance requests.")}
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                  {activeTickets.slice(0, 3).map((t) => (
                    <RequestCard key={t.id} t={t} compact />
                  ))}
                </Box>
              )}
            </Panel>
          )}
        </Box>

        <Panel title={t("House rules & curfew")} icon={<PolicyOutlinedIcon fontSize="small" />} sx={rise(3)}>
          {!hasHouseRules ? (
            <Typography variant="body2" color="text.secondary">
              {t("The owner hasn't posted house rules for this property yet.")}
            </Typography>
          ) : (
            <>
              {curfewTime && (
                <Box sx={{ ...row, gap: 1.25, p: 1.5, mb: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}>
                  <ScheduleIcon color="primary" />
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>{t("Curfew at")}{" "}{curfewTime}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("Residents should be back by then.")}
                    </Typography>
                  </Box>
                </Box>
              )}
              {rules.length > 0 && (
                <>
                  <Box component="ol" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.9 }}>
                    {(rulesOpen ? rules : rules.slice(0, RULES_PREVIEW)).map((r, i) => (
                      <Typography component="li" variant="body2" key={`${i}-${r}`} sx={{ overflowWrap: "anywhere" }}>
                        {r}
                      </Typography>
                    ))}
                  </Box>
                  {rules.length > RULES_PREVIEW && (
                    <Button
                      size="small"
                      onClick={() => setRulesOpen((v) => !v)}
                      aria-expanded={rulesOpen}
                      endIcon={<ExpandMoreIcon sx={{ transform: rulesOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                      sx={{ mt: 1, minHeight: 40, fontWeight: 700, textTransform: "none" }}
                    >
                      {rulesOpen ? t("Show fewer rules") : `Show all ${rules.length} rules`}
                    </Button>
                  )}
                </>
              )}
              {ruleFiles.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: rules.length > 0 ? 2 : 0 }}>
                  {ruleFiles.map((f, i) => (
                    <Button key={`${i}-${f.url}`} onClick={() => setPreviewFile(f)}
                      variant="outlined" startIcon={<DescriptionOutlinedIcon />} sx={{ justifyContent: "flex-start", fontWeight: 700, borderRadius: 2.5, minHeight: 44, textTransform: "none" }}>
                      {f.name || t("House rules document")}
                    </Button>
                  ))}
                </Box>
              )}
            </>
          )}
        </Panel>
        <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      </Box>
    </>
  );
}
