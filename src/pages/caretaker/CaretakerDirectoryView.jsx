// Caretaker area · Tenants: the directory, grouped by room.
// Rendered by CaretakerDashboard.jsx, which owns the data and actions and passes them in.
import { Box, Button, Paper } from "@mui/material";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { cardSx, ROOM_PAGE, EmptyState, StatTile, RoomHeader, groupByRoom, FilterChips, SearchBox, TenantCard } from "./caretakerParts";
import { t } from "../../i18n";

export default function CaretakerDirectoryView({ activeTenants, canFinancials, canOccupancy, curfewTime, filteredTenants, occupiedRooms, rentState, roomsShown, search, setRoomsShown, setSearch, setSelectedTenantId, setTenantFilter, tenantFilter, tenants, totalRooms }) {
  return (
    <>
      {canOccupancy && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 1.25, md: 2 }, mb: { xs: 2, sm: 3 } }}>
          <StatTile title={t("Total occupants")} value={activeTenants.length} subtitle={t("Active tenants")} icon={<PeopleAltOutlinedIcon fontSize="small" />} />
          <StatTile title={t("Rooms in use")} value={`${occupiedRooms}/${totalRooms}`} subtitle={`${Math.max(0, totalRooms - occupiedRooms)} available`} icon={<MeetingRoomOutlinedIcon fontSize="small" />} />
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>
            <StatTile title={t("Curfew")} value={curfewTime || "Not set"} subtitle={curfewTime ? "Residents back by then" : "No curfew for this property"} icon={<ScheduleIcon fontSize="small" />} />
          </Box>
        </Box>
      )}
      <Box sx={{ mb: 1.5 }}>
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setRoomsShown(ROOM_PAGE);
          }}
          placeholder={t("Search name or room")}
        />
      </Box>
      <FilterChips
        value={tenantFilter}
        onChange={(v) => {
          setTenantFilter(v);
          setRoomsShown(ROOM_PAGE);
        }}
        options={[
          { id: "active", label: t("Active"), n: activeTenants.length },
          { id: "inactive", label: t("Inactive"), n: tenants.length - activeTenants.length },
          { id: "all", label: t("All"), n: tenants.length },
        ]}
      />
      {filteredTenants.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState
            icon={<PeopleAltOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
            title={search ? "No match" : "No tenants here"}
            body={search ? `Nobody matches "${search}".` : "Tenants registered by the owner will show up here."}
            action={
              search ? (
                <Button onClick={() => setSearch("")} sx={{ mt: 1.5, fontWeight: 700 }}>
                  {t("Clear search")}
                </Button>
              ) : undefined
            }
          />
        </Paper>
      ) : (
        (() => {
          const groups = groupByRoom(filteredTenants);
          const shown = groups.slice(0, roomsShown);
          const tenantsLeft = groups.slice(roomsShown).reduce((n, [, list]) => n + list.length, 0);
          return (
            <>
              {shown.map(([room, list]) => (
                <Box key={room || "none"} sx={{ mb: 2 }}>
                  <RoomHeader title={room ? `Room ${room}` : "No room yet"} meta={`${list.length} ${list.length === 1 ? "tenant" : "tenants"}`} />
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                    {list.map((t) => (
                      <TenantCard key={t.id} t={t} showRent={canFinancials} rentState={rentState[t.id]} onClick={() => setSelectedTenantId(t.id)} />
                    ))}
                  </Box>
                </Box>
              ))}
              {groups.length > ROOM_PAGE && (
                <Box sx={{ textAlign: "center", mt: 1 }}>
              <Button size="small" onClick={() => setRoomsShown((n) => (n >= groups.length ? ROOM_PAGE : n + ROOM_PAGE))} sx={{ fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.5, textTransform: "none" }}>
                {roomsShown >= groups.length ? t("Show fewer rooms") : `Show ${Math.min(ROOM_PAGE, groups.length - roomsShown)} more rooms (${tenantsLeft} ${tenantsLeft === 1 ? "tenant" : "tenants"})`}
              </Button>
            </Box>
              )}
            </>
          );
        })()
      )}
    </>
  );
}
