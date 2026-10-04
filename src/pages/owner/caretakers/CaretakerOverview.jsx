import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PaymentIcon from "@mui/icons-material/Payment";
import PolicyIcon from "@mui/icons-material/Policy";
import SearchIcon from "@mui/icons-material/Search";
import WifiIcon from "@mui/icons-material/Wifi";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../../config/firebase";

const SECTION_TITLES = {
  overview: "Assigned Property Overview",
  properties: "Assigned Property",
  tenants: "Tenants",
  payments: "Payments",
  maintenance: "Maintenance",
};

const money = (amount) => `₱${(Number(amount) || 0).toLocaleString()}`;

export function MetricCard({ title, value, subtitle, icon }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="600">{title}</Typography>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: "#F5F5F5" }}>{icon}</Box>
        </Box>
        <Typography variant="h4" fontWeight="800">{value}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </CardContent>
    </Card>
  );
}

export default function CaretakerOverview({ section = "overview" }) {
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/login", { replace: true });
      return undefined;
    }

    let active = true;
    let unsubscribeUsers;
    let unsubscribeLegacyTenants;
    let unsubscribeTickets;
    let unsubscribePayments;

    const loadAssignedProperty = async () => {
      try {
        const [userSnapshot, caretakerSnapshot] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "caretakers", user.uid)),
        ]);
        const profile = {
          ...(userSnapshot.exists() ? userSnapshot.data() : {}),
          ...(caretakerSnapshot.exists() ? caretakerSnapshot.data() : {}),
        };
        const propertyId = profile.assignedPropertyId || profile.propertyId;
        if (active) setPermissions(profile.permissions || {});

        if (!propertyId) {
          if (active) setError("No property has been assigned to this caretaker account.");
          return;
        }

        const propertySnapshot = await getDoc(doc(db, "properties", propertyId));
        if (!propertySnapshot.exists()) {
          if (active) setError("The assigned property could not be found.");
          return;
        }

        const propertyData = { id: propertySnapshot.id, ...propertySnapshot.data() };
        if (!active) return;
        setProperty(propertyData);

        let userTenants = [];
        let legacyTenants = [];
        const updateTenants = () => {
          const merged = new Map();
          [...legacyTenants, ...userTenants].forEach((tenant) => {
            const tenantId = tenant.id || tenant.uid;
            if (!tenantId) return;
            const combined = { ...(merged.get(tenantId) || {}), ...tenant };
            const roomValue = combined.roomNumber || combined.roomId || combined.room || "";
            const room = (propertyData.rooms || []).find((candidate) =>
              [candidate.id, candidate.roomName, candidate.roomNumber]
                .filter(Boolean)
                .some((value) => String(value) === String(roomValue))
            );
            merged.set(tenantId, {
              ...combined,
              id: tenantId,
              name: combined.name || combined.fullName || "Tenant",
              roomNumber: roomValue,
              contact: combined.phone || combined.contact || combined.email || "—",
              monthlyRent: Number(combined.monthlyRent || combined.rent || room?.monthlyRatePerBed || 0),
            });
          });
          if (active) setTenants([...merged.values()]);
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
            console.error("Failed to load property tenants:", snapshotError);
            if (active) setError("Unable to load tenants for this property.");
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
            console.error("Failed to load legacy tenant records:", snapshotError);
            if (active) setError("Unable to load tenants for this property.");
          }
        );

        unsubscribeTickets = onSnapshot(
          query(collection(db, "maintenance_tickets"), where("propertyId", "==", propertyId)),
          (snapshot) => {
            if (active) setTickets(snapshot.docs.map((ticket) => ({ id: ticket.id, ...ticket.data() })));
          },
          (snapshotError) => {
            console.error("Failed to load property maintenance:", snapshotError);
            if (active) setError("Unable to load maintenance requests for this property.");
          }
        );

        if (profile.permissions?.viewFinancials === true) {
          unsubscribePayments = onSnapshot(
            query(collection(db, "payments"), where("propertyId", "==", propertyId)),
            (snapshot) => {
              if (active) setPayments(snapshot.docs.map((payment) => ({ id: payment.id, ...payment.data() })));
            },
            (snapshotError) => {
              console.error("Failed to load rent payments:", snapshotError);
              if (active) setError("Unable to load rent payment records for this property.");
            }
          );
        }
      } catch (loadError) {
        console.error("Failed to load caretaker property data:", loadError);
        if (active) setError("Unable to load the assigned property. Check Firestore access.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAssignedProperty();
    return () => {
      active = false;
      unsubscribeUsers?.();
      unsubscribeLegacyTenants?.();
      unsubscribeTickets?.();
      unsubscribePayments?.();
    };
  }, [navigate]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }

  const rooms = Array.isArray(property?.rooms) ? property.rooms : [];
  const propertyName = property?.propertyName || property?.name || "No assigned property";
  const address = typeof property?.address === "string"
    ? property.address
    : [property?.address?.street, property?.address?.barangay, property?.address?.cityMunicipality, property?.address?.province]
        .filter(Boolean)
        .join(", ");
  const activeTenants = tenants.filter((tenant) => String(tenant.status || "Active").toLowerCase() !== "inactive");
  const expectedMonthlyRent = activeTenants.reduce((sum, tenant) => sum + (Number(tenant.monthlyRent) || 0), 0);
  const openTickets = tickets.filter((ticket) => String(ticket.status || "Pending").toLowerCase() !== "resolved");
  const occupiedRooms = rooms.filter((room) => String(room.status || "").toLowerCase() === "occupied" || Number(room.occupiedBeds) > 0).length;
  const pendingTenants = tenants
    .filter((tenant) => String(tenant.status || "").toLowerCase().includes("pending"))
    .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
  const paidPayments = payments.filter((payment) =>
    ["paid", "complete", "completed", "received"].includes(String(payment.status || "Paid").toLowerCase())
  );
  const recentPayments = [...paidPayments].sort((first, second) => {
    const firstDate = first.paidAt?.toDate?.() || new Date(first.paidAt || first.paymentDate || first.createdAt || 0);
    const secondDate = second.paidAt?.toDate?.() || new Date(second.paidAt || second.paymentDate || second.createdAt || 0);
    return secondDate - firstDate;
  });
  const currentDate = new Date();
  const paymentsThisMonth = paidPayments.filter((payment) => {
    const rawDate = payment.paidAt || payment.paymentDate || payment.createdAt;
    const paymentDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || 0);
    return !Number.isNaN(paymentDate.getTime()) &&
      paymentDate.getMonth() === currentDate.getMonth() &&
      paymentDate.getFullYear() === currentDate.getFullYear();
  });
  const rentCollectedThisMonth = paymentsThisMonth.reduce(
    (total, payment) => total + (Number(payment.amount ?? payment.amountPaid ?? payment.rentAmount) || 0),
    0
  );
  const filteredTenants = tenants.filter((tenant) =>
    `${tenant.name} ${tenant.roomNumber} ${tenant.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const canViewPayments = permissions.viewFinancials === true;

  if (section === "payments" && !canViewPayments) {
    return <Alert severity="info">Your caretaker account does not have permission to view payment details.</Alert>;
  }

  return (
    <Container maxWidth="xl" disableGutters>
      {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}
      <Typography variant="h5" fontWeight="700" sx={{ mb: 3 }}>
        {SECTION_TITLES[section] || SECTION_TITLES.overview}
      </Typography>

      {section === "overview" && (
        <>
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard title="Total Managed Rooms" value={rooms.length} subtitle="Assigned property capacity" icon={<MeetingRoomIcon sx={{ color: "#FF6B35" }} />} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard title="Pending Repairs" value={openTickets.length} subtitle="Requests not marked resolved" icon={<BuildOutlinedIcon sx={{ color: "#D97706" }} />} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard title="Rent Collected" value={canViewPayments ? money(rentCollectedThisMonth) : "Restricted"} subtitle={canViewPayments ? (paymentsThisMonth.length ? "This month" : "No payment records this month") : "Financial permission required"} icon={<PaymentIcon sx={{ color: "#15803D" }} />} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard title="Occupied Units" value={occupiedRooms} subtitle={`${Math.max(rooms.length - occupiedRooms, 0)} available`} icon={<HomeWorkIcon sx={{ color: "#0288D1" }} />} />
            </Grid>
          </Grid>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1 }}>
                <Typography variant="h6" fontWeight="700">Recent Rent Collected</Typography>
                {canViewPayments && <Button size="small" onClick={() => navigate("/caretaker/payments")}>View all</Button>}
              </Box>
              {!canViewPayments ? (
                <Typography variant="body2" color="text.secondary">Financial permission is required to view rent records.</Typography>
              ) : recentPayments.length ? (
                <Stack spacing={1.5}>
                  {recentPayments.slice(0, 5).map((payment) => {
                    const paymentDate = payment.paidAt?.toDate?.() || new Date(payment.paidAt || payment.paymentDate || payment.createdAt || 0);
                    return (
                      <Box key={payment.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 1.5, bgcolor: "#FAFAFA", borderRadius: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight="700">{payment.tenantName || "Tenant"}</Typography>
                          <Typography variant="caption" color="text.secondary">Room {payment.roomNumber || "—"} · {Number.isNaN(paymentDate.getTime()) ? "Date unavailable" : paymentDate.toLocaleDateString()}</Typography>
                        </Box>
                        <Typography variant="subtitle2" fontWeight="700" sx={{ flexShrink: 0 }}>{money(payment.amount ?? payment.amountPaid ?? payment.rentAmount)}</Typography>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No payment records are available for this property.</Typography>
              )}
            </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1 }}>
                <Typography variant="h6" fontWeight="700">Tenant Onboarding</Typography>
                <Chip size="small" color={pendingTenants.length ? "warning" : "default"} label={`${pendingTenants.length} pending`} />
              </Box>
              {pendingTenants.length ? (
                <Stack spacing={1.5}>
                  {pendingTenants.slice(0, 5).map((tenant) => (
                    <Box key={tenant.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 1.5, bgcolor: "#FAFAFA", borderRadius: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight="700">{tenant.name || tenant.fullName || "Tenant"}</Typography>
                        <Typography variant="caption" color="text.secondary">Room {tenant.roomNumber || tenant.roomId || "Not assigned"}</Typography>
                      </Box>
                      <Chip size="small" color="warning" label={tenant.status || "Pending"} />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No tenants are pending onboarding.</Typography>
              )}
            </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {section === "properties" && (
        <>
          <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="700">{propertyName}</Typography>
            <Typography variant="body2" color="text.secondary">{address || "No address provided"}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {rooms.length} rooms • {rooms.reduce((sum, room) => sum + Number(room.capacity || room.beds || room.totalBeds || 0), 0)} beds
            </Typography>
          </Paper>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))", gap: 2.5 }}>
            {rooms.map((room, index) => (
              <Paper key={room.id || room.roomName || index} elevation={0} sx={{ minHeight: 170, p: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", bgcolor: "#F2EADF", border: "1px solid #D8CEC2", borderRadius: 2 }}>
                <Typography variant="h6" fontWeight="600">{room.roomName || room.roomNumber || `Room ${index + 1}`}</Typography>
                <Typography>Floor {room.floor || "—"} • {Number(room.capacity || room.beds || room.totalBeds || 0)} Beds</Typography>
                <Typography variant="body2" color="text.secondary">{Number(room.occupiedBeds || 0)} occupied</Typography>
                <Typography variant="h6" sx={{ color: "#FF4D0A", mt: 0.5 }}>{money(room.monthlyRatePerBed || room.rentPerBed)} <Typography component="span" variant="body2">/ bed</Typography></Typography>
              </Paper>
            ))}
            {rooms.length === 0 && <Typography color="text.secondary">No rooms are configured for this property.</Typography>}
          </Box>
          <Divider sx={{ my: 3 }} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}><WifiIcon color="primary" /><Typography variant="h6">Amenities</Typography></Stack>
              {property?.amenities?.length ? <Stack direction="row" flexWrap="wrap" gap={1}>{property.amenities.map((item, index) => <Chip key={`${item}-${index}`} label={item} variant="outlined" />)}</Stack> : <Typography color="text.secondary">No amenities listed.</Typography>}
            </Box>
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}><PolicyIcon color="primary" /><Typography variant="h6">House Rules</Typography></Stack>
              <Typography color="text.secondary" sx={{ whiteSpace: "pre-line" }}>{Array.isArray(property?.rules) ? property.rules.join("\n") || "No house rules specified." : property?.rulesText || property?.rules || "No house rules specified."}</Typography>
            </Box>
          </Box>
        </>
      )}

      {section === "tenants" && (
        <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5, flexWrap: "wrap", gap: 2 }}>
            <Typography variant="h6" fontWeight="700">Tenants at {propertyName}</Typography>
            <TextField size="small" placeholder="Search tenant or room..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          </Box>
          <TenantTable tenants={filteredTenants} />
        </Paper>
      )}

      {section === "payments" && (
        <>
          <Box sx={{ maxWidth: 420, mb: 3 }}><MetricCard title="Expected Monthly Rent" value={money(expectedMonthlyRent)} subtitle="Sum of active tenant rent amounts" icon={<PaymentIcon sx={{ color: "#15803D" }} />} /></Box>
          <Alert severity="info" sx={{ my: 2 }}>Payment transactions are not recorded in the system yet. These figures show expected monthly rent, not payments received.</Alert>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>Monthly Rent by Tenant</Typography>
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: "#F5F5F5" }}><TableRow><TableCell><strong>Tenant</strong></TableCell><TableCell><strong>Room</strong></TableCell><TableCell align="right"><strong>Expected Monthly Rent</strong></TableCell></TableRow></TableHead>
                <TableBody>
                  {activeTenants.length ? activeTenants.map((tenant) => <TableRow key={tenant.id}><TableCell>{tenant.name}</TableCell><TableCell>{tenant.roomNumber || "—"}</TableCell><TableCell align="right">{money(tenant.monthlyRent)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} align="center">No active tenants found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {section === "maintenance" && (
        permissions.handleReports === true
          ? <MaintenancePanel tickets={tickets} />
          : <Alert severity="info">Your caretaker account does not have permission to view maintenance reports.</Alert>
      )}
    </Container>
  );
}

function TenantTable({ tenants }) {
  return (
    <TableContainer>
      <Table>
        <TableHead sx={{ bgcolor: "#F5F5F5" }}>
          <TableRow><TableCell><strong>Tenant Name</strong></TableCell><TableCell><strong>Assigned Room</strong></TableCell><TableCell><strong>Contact</strong></TableCell><TableCell><strong>Status</strong></TableCell></TableRow>
        </TableHead>
        <TableBody>
          {tenants.length ? tenants.map((tenant) => (
            <TableRow key={tenant.id} hover>
              <TableCell><Typography variant="subtitle2" fontWeight="700">{tenant.name}</Typography></TableCell>
              <TableCell>{tenant.roomNumber || "—"}</TableCell>
              <TableCell>{tenant.contact}</TableCell>
              <TableCell><Chip label={tenant.status || "Active"} color={tenant.status === "Inactive" ? "default" : "success"} size="small" /></TableCell>
            </TableRow>
          )) : <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No tenant records found for this property.</Typography></TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MaintenancePanel({ tickets }) {
  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid #E0E0E0", borderRadius: 2 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
        <BuildOutlinedIcon sx={{ color: "#D97706" }} />
        <Typography variant="h6" fontWeight="700">Maintenance Requests</Typography>
      </Stack>
      {tickets.length ? (
        <Stack spacing={1.5}>
          {tickets.map((ticket) => (
            <Box key={ticket.id} sx={{ p: 2, bgcolor: "#FAFAFA", border: "1px solid #E0E0E0", borderRadius: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                <Typography fontWeight="700">{ticket.title || "Maintenance request"}</Typography>
                <Chip size="small" label={ticket.status || "Pending"} color={String(ticket.status).toLowerCase() === "resolved" ? "success" : "warning"} />
              </Box>
              <Typography variant="caption" color="text.secondary">{ticket.tenantName || "Tenant"} • Room {ticket.roomNumber || "—"}</Typography>
              {ticket.description && <Typography variant="body2" sx={{ mt: 1 }}>{ticket.description}</Typography>}
            </Box>
          ))}
        </Stack>
      ) : <Typography color="text.secondary">No maintenance requests for this property.</Typography>}
    </Paper>
  );
}