// Caretaker area · Tenants: tonight's curfew check.
// Rendered by CaretakerDashboard.jsx, which owns the data and actions and passes them in.
import { Alert, Box, Button, LinearProgress, Paper, Switch, FormControlLabel, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { row, cardSx, timeOf, Pill, EmptyState, RoomHeader, groupByRoom, FilterChips, SearchBox, CheckRow } from "./caretakerParts";
import { t } from "../../i18n";

export default function CaretakerCurfewView({ autoNotify, checkCounts, checkFilter, checkQuery, checkSearch, checkTenants, checkedCount, curfewHeadline, curfewPhase, entryOf, markAllPresent, markRoomIn, occError, occMeta, online, openNotice, pastCurfew, remindRecipients, reminderPreset, setCheck, setCheckFilter, setCheckSearch, shownChecks, statusOf, toggleAutoNotify, uncheckedCount }) {
  return (
    <>
      {occError && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {t("Tonight's check couldn't be loaded, so saved marks may not show. Ask the owner to review your access.")}
        </Alert>
      )}

      {/* Where tonight stands */}
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 2.5 }, mb: 2, borderColor: pastCurfew && checkCounts.out > 0 ? "error.main" : "divider" }}>
        <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, mb: 1.25 }}>
          <Box sx={{ ...row, gap: 1, minWidth: 0 }}>
            <ScheduleIcon color={pastCurfew ? "primary" : "action"} fontSize="small" />
            <Typography sx={{ fontWeight: 800 }}>{curfewHeadline}</Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 700, flexShrink: 0 }}>
            {checkedCount}/{checkTenants.length}
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={checkTenants.length ? (checkedCount / checkTenants.length) * 100 : 0} sx={{ height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
        <Box sx={{ display: "flex", gap: 0.75, mt: 1.5, flexWrap: "wrap" }}>
          <Pill label={`${checkCounts.present} in`} tone="success" />
          <Pill label={`${checkCounts.late} late`} tone="warning" />
          <Pill label={`${checkCounts.out} out${pastCurfew && checkCounts.out > 0 ? " past curfew" : ""}`} tone="error" />
          {uncheckedCount > 0 && <Pill label={`${uncheckedCount} to check`} />}
        </Box>
        {curfewPhase === "none" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
            {t("The owner hasn't set a curfew, but you can still log who is in each night.")}
          </Typography>
        )}
      </Paper>

      {/* Automation + bulk actions */}
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <FormControlLabel
          control={<Switch checked={autoNotify} onChange={(e) => toggleAutoNotify(e.target.checked)} />}
          label={
            <Box>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>{t("Notify automatically")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("Tell a tenant when they're marked late or out. The owner is alerted when someone is out.")}
              </Typography>
            </Box>
          }
          sx={{ alignItems: "flex-start", m: 0, width: "100%", "& .MuiSwitch-root": { mr: 1 } }}
        />
        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<CheckCircleOutlinedIcon />}
            disabled={uncheckedCount === 0}
            onClick={markAllPresent}
            sx={{ flex: "1 1 180px", minHeight: 46, fontWeight: 700, borderRadius: 2.5, textTransform: "none" }}
          >
            {t("Mark the rest as in")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<SendOutlinedIcon />}
            disabled={remindRecipients.length === 0}
            onClick={() => openNotice(remindRecipients, reminderPreset)}
            sx={{ flex: "1 1 180px", minHeight: 46, fontWeight: 700, borderRadius: 2.5, textTransform: "none" }}
          >
            {t("Remind")}{" "}{remindRecipients.length}{" "}{t("not in")}
          </Button>
        </Box>
        {occMeta.pending && (
          <Box sx={{ ...row, gap: 0.75, mt: 1.25, color: online ? "text.secondary" : "warning.main" }}>
            <CloudOffOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {online ? t("Saving...") : t("Saved on this phone. It sends when you're back online, even if you close the app.")}
            </Typography>
          </Box>
        )}
        {occMeta.reminderSentAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {t("Last reminder sent at")}{" "}{timeOf(occMeta.reminderSentAt)}.
          </Typography>
        )}
      </Paper>

      {checkTenants.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title={t("No residents to check")} body={t("Tenants with an assigned room will appear here.")} />
        </Paper>
      ) : (
        <>
          {/* Stays in view while you scroll through the rooms */}
          <Box
            sx={{
              position: "sticky",
              top: { xs: 56, md: 80 },
              zIndex: 2,
              bgcolor: "background.paper",
              mx: { xs: -2, sm: -3 },
              px: { xs: 2, sm: 3 },
              pt: 1.25,
              pb: 1.25,
              mb: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ ...row, justifyContent: "space-between", mb: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                {checkedCount}{" "}{t("of")}{" "}{checkTenants.length}{" "}{t("checked")}
              </Typography>
              <Typography variant="caption" color={occMeta.pending && !online ? "warning.main" : "text.secondary"} sx={{ fontWeight: occMeta.pending && !online ? 800 : undefined }}>
                {occMeta.pending && !online ? t("Not saved yet · ") : occMeta.pending ? t("Saving · ") : ""}
                {checkCounts.out}{" "}{t("out ·")}{" "}{checkCounts.late}{" "}{t("late ·")}{" "}{uncheckedCount}{" "}{t("to go")}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={(checkedCount / checkTenants.length) * 100} sx={{ height: 5, borderRadius: 3, mb: 1.25, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
            <SearchBox value={checkSearch} onChange={setCheckSearch} placeholder={t("Find a name or room")} />
            <Box sx={{ mt: 1 }}>
              <FilterChips
                flush
                value={checkFilter}
                onChange={setCheckFilter}
                options={[
                  { id: "todo", label: t("To check"), n: uncheckedCount },
                  { id: "out", label: t("Out"), n: checkCounts.out },
                  { id: "late", label: t("Late"), n: checkCounts.late },
                  { id: "present", label: t("In"), n: checkCounts.present },
                  { id: "all", label: t("All"), n: checkTenants.length },
                ]}
              />
            </Box>
          </Box>

          {shownChecks.length === 0 ? (
            <Paper elevation={0} sx={cardSx}>
              <EmptyState
                icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
                title={checkQuery ? "No match" : checkFilter === "todo" ? "Everyone is checked" : "Nobody here"}
                body={checkQuery ? `Nobody matches "${checkSearch}".` : checkFilter === "todo" ? "Nice work. Switch to All to change any mark." : "No tenants match this filter."}
              />
            </Paper>
          ) : (
            // Walk the building room by room
            groupByRoom(shownChecks).map(([room, list]) => (
              <Box key={room || "none"} sx={{ mb: 2 }}>
                <RoomHeader
                  title={`Room ${room}`}
                  meta={`${list.length} ${list.length === 1 ? "tenant" : "tenants"}`}
                  action={
                    list.some((t) => statusOf(t) !== "present") && (
                      <Button size="small" onClick={() => markRoomIn(list)} sx={{ minHeight: 36, fontWeight: 800, textTransform: "none" }}>
                        {t("All in")}
                      </Button>
                    )
                  }
                />
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                  {list.map((t) => (
                    <CheckRow key={t.id} t={t} entry={entryOf(t)} past={pastCurfew} onSet={setCheck} onNotice={(x) => openNotice([x])} />
                  ))}
                </Box>
              </Box>
            ))
          )}
        </>
      )}
    </>
  );
}
