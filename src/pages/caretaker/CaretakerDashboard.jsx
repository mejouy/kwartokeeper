import { useEffect, useState, useMemo } from "react";
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
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";

import { onAuthStateChanged } from "firebase/auth";
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

// AHP-based maintenance prioritization
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
  const [assignedProperty, setAssignedProperty] = useState("Loading facility...");
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Maintenance Requests state
  const [tickets, setTickets] = useState([]);
  const [permissions, setPermissions] = useState({});

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
    let active = true;
    let unsubscribeUsers;
    let unsubscribeLegacyTenants;
    let unsubscribeTickets;

    // Use onAuthStateChanged to prevent false logouts on hard page reloads
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) navigate("/login");
        return;
      }

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
              setError("Ask the property owner to assign a facility to this account.");
              setLoading(false);
            }
            return;
          }

          const propertySnapshot = await getDoc(doc(db, "properties", propertyId));
          if (!propertySnapshot.exists()) {
            if (active) {
              setAssignedProperty("Facility not found");
              setError("The assigned facility could not be found.");
              setLoading(false);
            }
            return;
          }

          const property = propertySnapshot.data();
          if (!active) return;

          setAssignedProperty(property.propertyName || property.name || propertyId);
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
            }
          );

          unsubscribeLegacyTenants = onSnapshot(
            query(collection(db, "tenants"), where("propertyId", "==", propertyId)),
            (snapshot) => {
              legacyTenants = snapshot.docs.map((tenantDoc) => ({
                id: tenantDoc.id,
                ...tenantDoc.data(),
              }));
              updateTenants();
            },
            (snapshotError) => {
              console.error("Failed to load legacy tenant profiles:", snapshotError);
              if (active) setError("Unable to load tenants for this facility.");
            }
          );

          unsubscribeTickets = onSnapshot(
            query(collection(db, "maintenance_tickets"), where("propertyId", "==", propertyId)),
            (snapshot) => {
              const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
              if (active) setTickets(docs);
            },
            (snapshotError) => {
              console.error("Failed to load maintenance tickets:", snapshotError);
            }
          );
        } catch (loadError) {
          console.error("Failed to load caretaker facility:", loadError);
          if (active) {
            setError("Unable to load the assigned facility. Check your Firestore access.");
          }
        } finally {
          if (active) setLoading(false);
        }
      };

      loadAssignedFacility();
    });

    return () => {
      active = false;
      unsubscribeAuth();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeLegacyTenants) unsubscribeLegacyTenants();
      if (unsubscribeTickets) unsubscribeTickets();
    };
  }, [navigate]);

  // Derived metrics
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(
    (room) => room.status === "Occupied" || Number(room.occupiedBeds) > 0
  ).length;
  const totalTenants = tenants.filter((tenant) => tenant.status !== "Inactive").length;

  // Memoize filtered tenants so search doesn't block the main thread unnecessarily
  const filteredTenants = useMemo(() => {
    return tenants.filter(
      (t) =>
        t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.roomNumber?.toString().includes(searchTerm)
    );
  }, [tenants, searchTerm]);

  // Memoize AHP-ranked tickets so re-rendering doesn't rerun complex math
  const rankedTickets = useMemo(() => {
    return rankMaintenanceRequests(tickets);
  }, [tickets]);

  const canHandleReports = permissions?.handleReports === true;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      {/* Top Header Navigation */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header Title */}
        <Box id="caretaker-overview" sx={{ mb: 4, scrollMarginTop: 16 }}>
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
          id="caretaker-tenants"
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
                        No tenant records found for this search/facility.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id} hover>
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
                          color={tenant.status === "Inactive" ? "default" : "success"}
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

        {/* Maintenance Requests */}
        <Box id="caretaker-maintenance" sx={{ scrollMarginTop: 16 }}>
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
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
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
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
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
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
        {!canHandleReports && (
          <Alert severity="info">
            Maintenance request access is not enabled for this caretaker account.
          </Alert>
        )}
        </Box>
      </Container>
    </Box>
  );
}

function MetricCard({ title, value, subtitle, icon }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
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