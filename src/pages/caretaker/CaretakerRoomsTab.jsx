// Caretaker area · Rooms: beds, occupancy and rates.
// Rendered by CaretakerDashboard.jsx, which owns the data and actions and passes them in.
import { Box, Button, Divider, Drawer, LinearProgress, Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import { row, cardSx, ROOM_STATUS, RoomTile } from "./caretakerParts";
import { t } from "../../i18n";

export default function CaretakerRoomsTab({ bedsTaken, isDesktop, occPct, openRoom, pickedRoom, pickedRoomId, roomBeds, roomPanel, rooms, roomsByFloor, setPickedRoomId, takenOf, vacantRooms }) {
  return (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 200px" }}>
          {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · {bedsTaken}/{roomBeds}{" "}{t("beds taken ·")}{" "}{vacantRooms}{" "}{t("vacant")}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openRoom()} sx={{ minHeight: 46, px: 2.5, fontWeight: 800, borderRadius: 2.5, textTransform: "none", flex: { xs: "1 1 100%", sm: "0 0 auto" } }}>
          {t("Add a room")}
        </Button>
      </Box>
      <LinearProgress variant="determinate" value={occPct} aria-label={`${occPct}% occupied`} sx={{ height: 6, borderRadius: 3, mb: 2.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 7fr) minmax(0, 5fr)" }, gap: 3, alignItems: "start" }}>
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
          <Box sx={{ ...row, gap: 1, mb: 2 }}>
            <GridViewOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }}>{t("Room map")}</Typography>
          </Box>
          {rooms.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
              {t("No rooms yet. Add the first one to start assigning tenants.")}
            </Typography>
          ) : (
            <>
              <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2, rowGap: 0.75, mb: 2.5 }}>
                {Object.values(ROOM_STATUS).map((st) => (
                  <Box key={st.label} sx={{ ...row, gap: 0.75 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: "4px", bgcolor: st.fill }} />
                    <Typography variant="caption" color="text.secondary">
                      {st.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {roomsByFloor.map(([floor, list], fIdx) => (
                  <Box key={floor}>
                    {fIdx > 0 && <Divider sx={{ mb: 2.5 }} />}
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.25 }}>
                      {t("Floor")}{" "}{floor}
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {" "}
                        · {list.length} {list.length === 1 ? "room" : "rooms"}
                      </Typography>
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 1.25 }}>
                      {list.map((r) => (
                        <RoomTile key={r.id || r.index} room={r} taken={takenOf(r)} selected={pickedRoomId === r.id} onClick={() => setPickedRoomId(r.id)} />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Paper>

        {/* Desktop: side card. Phones: bottom sheet below. */}
        {isDesktop && (
          <Paper elevation={0} sx={{ ...cardSx, p: 3, position: "sticky", top: 96, minHeight: 280 }}>
            {roomPanel || (
              <Box sx={{ minHeight: 232, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <Box sx={{ width: 56, height: 56, borderRadius: "50%", mb: 1.5, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.08)" }}>
                  <TouchAppOutlinedIcon sx={{ color: "primary.main" }} />
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{t("Select a room")}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t("Tap any room on the map to see its tenants or change its rate.")}
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {!isDesktop && (
        <Drawer
          anchor="bottom"
          open={Boolean(pickedRoom)}
          onClose={() => setPickedRoomId("")}
          slotProps={{
            paper: {
              sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85dvh", p: 2.5, pb: "calc(20px + env(safe-area-inset-bottom, 0px))" },
            },
          }}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider", mx: "auto", mb: 2 }} />
          {roomPanel}
        </Drawer>
      )}
    </>
  );
}
