import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import QRCode from "qrcode";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase";

// Matches the format used across the Owner Dashboard, e.g. "September 2026"
function currentPeriodMonth(date = new Date()) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatCurrency(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Payments() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tenantProfile, setTenantProfile] = useState(null);
  const [property, setProperty] = useState(null);
  const [monthlyRate, setMonthlyRate] = useState(null);
  const [payments, setPayments] = useState([]);

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");

  const currentMonth = currentPeriodMonth();
  const currentMonthPayment = payments.find(
    (p) => p.periodMonth === currentMonth && p.status === "Paid"
  );
  const lastPayment = payments.find((p) => p.status === "Paid");

  const loadData = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("You need to be logged in to view payments.");
        setLoading(false);
        return;
      }

      // Tenant's own profile (has propertyId / roomId)
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) {
        setError("Could not find your tenant profile.");
        setLoading(false);
        return;
      }
      const profile = userSnap.data();
      setTenantProfile(profile);

      // Look up the property (gives us ownerUid, propertyName, and the
      // room's monthlyRatePerBed from its embedded rooms array)
      if (profile.propertyId) {
        const propSnap = await getDoc(doc(db, "properties", profile.propertyId));
        if (propSnap.exists()) {
          const propertyData = { id: propSnap.id, ...propSnap.data() };
          setProperty(propertyData);
          const room = (propertyData.rooms || []).find(
            (r) => r.roomName === profile.roomId
          );
          setMonthlyRate(room?.monthlyRatePerBed ?? null);
        }
      }

      // Payment history for this tenant, matching the schema the Owner
      // Dashboard and TenantDetails.jsx already use (field: tenantId)
      const q = query(
        collection(db, "payments"),
        where("tenantId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => {
        const aTime = a.paymentDate?.toMillis?.() || 0;
        const bTime = b.paymentDate?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setPayments(rows);
    } catch (err) {
      setError("Something went wrong loading your payment info.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openPayDialog = async () => {
    const ref = `QRPH-SIM-${Date.now()}`;
    setReferenceNumber(ref);

    const payload = JSON.stringify({
      type: "QRPh (Simulated)",
      merchant: "KwartoKeeper",
      amount: monthlyRate,
      reference: ref,
      month: currentMonth,
    });

    try {
      const dataUrl = await QRCode.toDataURL(payload, { width: 260, margin: 2 });
      setQrDataUrl(dataUrl);
      setPayDialogOpen(true);
    } catch (err) {
      setError("Could not generate the payment QR code.");
    }
  };

  const handleSimulateConfirm = async () => {
    setConfirming(true);
    try {
      const user = auth.currentUser;

      await addDoc(collection(db, "payments"), {
        // Tenant-side identifiers, matching the Owner Dashboard's schema
        tenantId: user.uid,
        tenantName: tenantProfile?.name || tenantProfile?.fullName || "Tenant",

        // Property/room info
        propertyId: tenantProfile?.propertyId || null,
        propertyName: property?.propertyName || "Dormitory",
        roomNumber: tenantProfile?.roomId || null,

        // Payment details
        amount: monthlyRate,
        paymentMethod: "QRPh",
        periodMonth: currentMonth,
        status: "Paid",
        remarks: `Ref: ${referenceNumber} (self-paid via QRPh)`,

        // Needed so this shows up in the Owner's dashboard queries
        ownerUid: property?.ownerUid || null,

        paymentDate: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setPayDialogOpen(false);
      await loadData();
    } catch (err) {
      setError("Could not record the payment. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: 3 }}>
      <Typography variant="h1" sx={{ fontSize: "1.75rem", mb: 3 }}>
        Payments
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Current month due */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: "background.paper" }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            fontSize: "0.875rem",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "text.secondary",
            mb: 1,
          }}
        >
          {currentMonth}
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {monthlyRate !== null ? formatCurrency(monthlyRate) : "—"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Monthly rent
            </Typography>
          </Box>

          {currentMonthPayment ? (
            <Chip
              label={`Paid on ${formatDate(currentMonthPayment.paymentDate)}`}
              color="success"
              sx={{ fontWeight: 600 }}
            />
          ) : (
            <Button
              variant="contained"
              size="large"
              disabled={monthlyRate === null}
              onClick={openPayDialog}
            >
              Pay via QRPh
            </Button>
          )}
        </Box>
      </Paper>

      {/* Last payment summary */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: "background.paper" }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            fontSize: "0.875rem",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "text.secondary",
            mb: 1,
          }}
        >
          Last Payment
        </Typography>
        {lastPayment ? (
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body1">
              {lastPayment.periodMonth} — {formatCurrency(lastPayment.amount)}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {formatDate(lastPayment.paymentDate)}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No payments recorded yet.
          </Typography>
        )}
      </Paper>

      {/* Payment history */}
      <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper" }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            fontSize: "0.875rem",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "text.secondary",
            mb: 2,
          }}
        >
          Payment History
        </Typography>
        {payments.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No payment history yet.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.periodMonth}</TableCell>
                    <TableCell>{formatCurrency(p.amount)}</TableCell>
                    <TableCell>{formatDate(p.paymentDate)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={p.status}
                        color={p.status === "Paid" ? "success" : "default"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Pay dialog with QR code */}
      <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)}>
        <DialogTitle>Pay Rent via QRPh</DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            Scan this QR code using your GCash, Maya, or any QRPh-enabled
            banking app.
          </Typography>
          {qrDataUrl && (
            <Box
              component="img"
              src={qrDataUrl}
              alt="QRPh payment code"
              sx={{ width: 260, height: 260, mx: "auto", mb: 2 }}
            />
          )}
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            {formatCurrency(monthlyRate)}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Reference: {referenceNumber}
          </Typography>
          <Alert severity="info" sx={{ mt: 3, textAlign: "left" }}>
            This is a simulated payment for demo purposes. Click below to
            mark this payment as completed.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPayDialogOpen(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSimulateConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              "Simulate Payment Confirmation"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}