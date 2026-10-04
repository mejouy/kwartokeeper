import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Container,
  CircularProgress,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  AppBar,
  Toolbar,
  Button,
  Stack,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";

import HomeWorkIcon from "@mui/icons-material/HomeWork";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import SearchIcon from "@mui/icons-material/Search";
import LogoutIcon from "@mui/icons-material/Logout";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";

import { signOut } from "firebase/auth";
import { auth, db } from "../../config/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
// AHP-based maintenance prioritization (see src/utils/maintenancePrioritization.js
// for the full pairwise-comparison derivation and rationale).
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";

const TIER_CHIP_COLOR = {
  High: "error",
  Medium: "warning",
  Low: "default",
};

const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];

export default function CaretakerDashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [assignedProperty, setAssignedProperty] = useState(
    "Loading facility...",
  );
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Maintenance Requests state — gated behind the caretaker's `handleReports`
  // permission (set during the Caretaker Invite flow).
  const [tickets, setTickets] = useState([]);
  const [permissions, setPermissions] = useState({});

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Update a maintenance ticket's status (Pending -> In Progress -> Resolved).
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticketId), {
        status: newStatus,
      });
    } catch (err) {
      console.error("Failed to update ticket status:", err);
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return undefined;
    }

    let active = true;
    let unsubscribeUsers;
    let unsubscribeLegacyTenants;
    let unsubscribeTickets;

    const loadAssignedFacility = async () => {
      try {
        const [userProfile, caretakerProfile] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "caretakers", user.uid)),
        ]);
        const profile = {
          ...(userProfile.exists() ? userProfile.data() : {}),
          ...(caretakerProfile.exists() ? caretakerProfile.data() : {}),
        };
        const propertyId = profile.assignedPropertyId || profile.propertyId;

        if (active) {
          setPermissions(profile.permissions || {});
        }

        if (!propertyId) {
          if (active) {
            setAssignedProperty("No facility assigned");
            setError(
              "Ask the property owner to assign a facility to this account.",
            );
          }
          return;
        }

        const propertySnapshot = await getDoc(
          doc(db, "properties", propertyId),
        );
        if (!propertySnapshot.exists()) {
          if (active) {
            setAssignedProperty("Facility not found");
            setError("The assigned facility could not be found.");
          }
          return;
        }

        const property = propertySnapshot.data();
        if (!active) return;

        setAssignedProperty(
          property.propertyName || property.name || propertyId,
        );
        setRooms(Array.isArray(property.rooms) ? property.rooms : []);

        let userTenants = [];
        let legacyTenants = [];
        const updateTenants = () => {
          const mergedTenants = new Map();
          [...userTenants, ...legacyTenants].forEach((tenant) => {
            const tenantId = tenant.id || tenant.uid;
            if (!tenantId) return;
            const existing = mergedTenants.get(tenantId) || {};
            mergedTenants.set(tenantId, {
              ...existing,
              ...tenant,
              id: tenantId,
              name: tenant.name || tenant.fullName || existing.name || "Tenant",
              roomNumber:
                tenant.roomNumber ||
                tenant.roomId ||
                tenant.room ||
                existing.roomNumber ||
                "",
            });
          });
          if (active) setTenants([...mergedTenants.values()]);
        };

        unsubscribeUsers = onSnapshot(
          query(collection(db, "users"), where("propertyId", "==", propertyId)),
          (snapshot) => {
            userTenants = snapshot.docs
              .map((tenantDoc) => ({ id: tenantDoc.id, ...tenantDoc.data() }))
              .filter((tenant) => tenant.role === "tenant");
            updateTenants();
          },
          (snapshotError) => {
            console.error("Failed to load tenant profiles:", snapshotError);
            if (active) setError("Unable to load tenants for this facility.");
          },
        );
        unsubscribeLegacyTenants = onSnapshot(
          query(
            collection(db, "tenants"),
            where("propertyId", "==", propertyId),
          ),
          (snapshot) => {
            legacyTenants = snapshot.docs.map((tenantDoc) => ({
              id: tenantDoc.id,
              ...tenantDoc.data(),
            }));
            updateTenants();
          },
          (snapshotError) => {
            console.error(
              "Failed to load legacy tenant profiles:",
              snapshotError,
            );
            if (active) setError("Unable to load tenants for this facility.");
          },
        );

        // Maintenance tickets for the WHOLE facility (every tenant in this
        // property), not just one tenant — the caretaker manages all of them.
        unsubscribeTickets = onSnapshot(
          query(
            collection(db, "maintenance_tickets"),
            where("propertyId", "==", propertyId),
          ),
          (snapshot) => {
            const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (active) setTickets(docs);
          },
          (snapshotError) => {
            console.error("Failed to load maintenance tickets:", snapshotError);
          },
        );
      } catch (loadError) {
        console.error("Failed to load caretaker facility:", loadError);
        if (active)
          setError(
            "Unable to load the assigned facility. Check your Firestore access.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAssignedFacility();
    return () => {
      active = false;
      unsubscribeUsers?.();
      unsubscribeLegacyTenants?.();
      unsubscribeTickets?.();
    };
  }, [navigate]);

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(
    (room) => room.status === "Occupied" || Number(room.occupiedBeds) > 0,
  ).length;
  const totalTenants = tenants.filter(
    (tenant) => tenant.status !== "Inactive",
  ).length;

  const filteredTenants = tenants.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.roomNumber?.toString().includes(searchTerm),
  );

  // AHP-ranked tickets: High tier first, then Medium, then Low; within the
  // same tier, oldest-pending first.
  const rankedTickets = rankMaintenanceRequests(tickets);
  const canHandleReports = permissions?.handleReports === true;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      {/* Top Header Navigation */}
      <AppBar
        position="static"
        color="default"
        elevation={1}
        sx={{ bgcolor: "#ffffff" }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight="800" color="primary">
            KwartoKeeper
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary" fontWeight="600">
              Caretaker Portal
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header Title */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight="800">
            Caretaker Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Assigned Facility: <strong>{assignedProperty}</strong>
          </Typography>
        </Box>

        {error && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Metrics Row */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            gap: 2.5,
            mb: 4,
          }}
        >
          <MetricCard
            title="Total Managed Rooms"
            value={totalRooms}
            subtitle="Property capacity"
            icon={<MeetingRoomIcon color="primary" />}
          />
          <MetricCard
            title="Occupied Units"
            value={occupiedRooms}
            subtitle={`${totalRooms - occupiedRooms} available`}
            icon={<HomeWorkIcon color="info" />}
          />
          <MetricCard
            title="Active Tenants"
            value={totalTenants}
            subtitle="Registered residents"
            icon={<PeopleAltIcon color="success" />}
          />
        </Box>

        {/* Tenant Roster Table */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            mb: 4,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2.5,
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Typography variant="h6" fontWeight="700">
              Tenant Directory
            </Typography>
            <TextField
              size="small"
              placeholder="Search tenant name or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: "background.default" }}>
                <TableRow>
                  <TableCell>
                    <strong>Tenant Name</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Assigned Room</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Contact Info</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Status</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {loading ? (
                          <CircularProgress size={22} />
                        ) : (
                          "No tenant records found for this facility."
                        )}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id || tenant.uid} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="700">
                          {tenant.name || tenant.fullName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        Room {tenant.roomNumber || tenant.room}
                      </TableCell>
                      <TableCell>
                        {tenant.contact || tenant.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={tenant.status || "Active"}
                          color={
                            tenant.status === "Inactive" ? "default" : "success"
                          }
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Maintenance Requests — only visible to caretakers whose invite
            included the "Receive & Update Incident / Maintenance Reports"
            permission. */}
        {canHandleReports && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}
            >
              <BuildOutlinedIcon color="warning" />
              <Box>
                <Typography variant="h6" fontWeight="700">
                  Maintenance Requests
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All reports for this facility, ranked by AHP priority
                </Typography>
              </Box>
            </Box>

            <Stack spacing={1.5}>
              {rankedTickets.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  align="center"
                  sx={{ py: 3 }}
                >
                  No maintenance tickets reported for this facility.
                </Typography>
              ) : (
                rankedTickets.map((t) => (
                  <Box
                    key={t.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "background.default",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 1,
                        mb: 0.5,
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight="700">
                          {t.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.tenantName} — Room {t.roomNumber}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={t.priority.tier}
                          size="small"
                          color={TIER_CHIP_COLOR[t.priority.tier]}
                        />
                        <FormControl size="small">
                          <Select
                            value={t.status || "Pending"}
                            onChange={(e) =>
                              handleStatusChange(t.id, e.target.value)
                            }
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <MenuItem key={opt} value={opt}>
                                {opt}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Stack>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {t.description}
                    </Typography>
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        )}
      </Container>
    </Box>
  );
}

function MetricCard({ title, value, subtitle, icon }) {
  return (
    <Card
      elevation={0}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" fontWeight="600">
            {title}
          </Typography>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: "action.hover" }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" fontWeight="800">
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}
