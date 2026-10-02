import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/Person";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import PaymentIcon from "@mui/icons-material/Payment";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

export default function TenantDetails() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};

  const [tenant, setTenant] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTenantDetails = async () => {
      if (!currentUser?.uid || !tenantId) return;

      try {
        setLoading(true);

        // Get all users
        const usersSnap = await getDocs(collection(db, "users"));

        // Get legacy tenants
        const tenantsSnap = await getDocs(collection(db, "tenants"));

        const users = usersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const legacyTenants = tenantsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Find tenant
        const allTenants = [...users, ...legacyTenants];

        const foundTenant = allTenants.find(
          (t) =>
            t.id === tenantId ||
            t.uid === tenantId
        );

        if (foundTenant) {
          setTenant({
            ...foundTenant,
            fullName:
              foundTenant.fullName ||
              foundTenant.name ||
              "Unnamed Tenant",
            propertyName:
              foundTenant.propertyName ||
              "Dormitory",
            roomNumber:
              foundTenant.roomNumber ||
              foundTenant.roomId ||
              "",
            status:
              foundTenant.status ||
              "Active",
          });
        }

        // Load tenant payments
        const paymentsQuery = query(
          collection(db, "payments"),
          where("ownerUid", "==", currentUser.uid)
        );

        const paymentsSnap = await getDocs(paymentsQuery);

        const tenantPayments = paymentsSnap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(
            (payment) =>
              payment.tenantId === tenantId
          );

        setPayments(tenantPayments);

      } catch (error) {
        console.error("Error loading tenant details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTenantDetails();
  }, [tenantId, currentUser]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!tenant) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/owner/dashboard")}
          sx={{ mb: 3 }}
        >
          Back to Dashboard
        </Button>

        <Paper sx={{ p: 4 }}>
          <Typography variant="h6">
            Tenant not found
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            The tenant record could not be found.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>

        {/* Back Button */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/owner/dashboard")}
          sx={{ mb: 3 }}
        >
          Back to Dashboard
        </Button>

        {/* Page Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight="700">
            Tenant Details
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            View tenant information and payment history.
          </Typography>
        </Box>

        {/* Tenant Information */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            mb: 3,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "primary.main",
                color: "white",
              }}
            >
              <PersonIcon fontSize="large" />
            </Box>

            <Box sx={{ flexGrow: 1 }}>
              <Typography
                variant="h5"
                fontWeight="700"
              >
                {tenant.fullName}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Tenant ID: {tenant.id}
              </Typography>
            </Box>

            <Chip
              label={tenant.status}
              color={
                tenant.status === "Pending Onboarding"
                  ? "warning"
                  : "success"
              }
            />
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md: "1fr 1fr 1fr",
              },
              gap: 3,
            }}
          >
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Property
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 0.5 }}
              >
                <HomeWorkIcon fontSize="small" />

                <Typography fontWeight="600">
                  {tenant.propertyName}
                </Typography>
              </Stack>
            </Box>

            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Room
              </Typography>

              <Typography
                fontWeight="600"
                sx={{ mt: 0.5 }}
              >
                {tenant.roomNumber
                  ? `Room ${tenant.roomNumber}`
                  : "Unassigned"}
              </Typography>
            </Box>

            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Email
              </Typography>

              <Typography
                fontWeight="600"
                sx={{ mt: 0.5 }}
              >
                {tenant.email || "Not provided"}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Payment Summary */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
            },
            gap: 2,
            mb: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Total Payments Recorded
            </Typography>

            <Typography
              variant="h5"
              fontWeight="700"
              sx={{ mt: 1 }}
            >
              {payments.length}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Total Amount Paid
            </Typography>

            <Typography
              variant="h5"
              fontWeight="700"
              color="success.main"
              sx={{ mt: 1 }}
            >
              ₱
              {payments
                .reduce(
                  (total, payment) =>
                    total + Number(payment.amount || 0),
                  0
                )
                .toLocaleString()}
            </Typography>
          </Paper>
        </Box>

        {/* Payment History */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 3 }}
          >
            <PaymentIcon />

            <Box>
              <Typography
                variant="h6"
                fontWeight="700"
              >
                Payment History
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Tenant payment records
              </Typography>
            </Box>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Billing Period</strong>
                  </TableCell>

                  <TableCell>
                    <strong>Amount</strong>
                  </TableCell>

                  <TableCell>
                    <strong>Method</strong>
                  </TableCell>

                  <TableCell>
                    <strong>Status</strong>
                  </TableCell>

                  <TableCell>
                    <strong>Remarks</strong>
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        No payment records found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow
                      key={payment.id}
                      hover
                    >
                      <TableCell>
                        {payment.periodMonth || "N/A"}
                      </TableCell>

                      <TableCell>
                        <Typography
                          fontWeight="700"
                          color="success.main"
                        >
                          ₱
                          {Number(
                            payment.amount || 0
                          ).toLocaleString()}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        {payment.paymentMethod || "N/A"}
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={
                            payment.status || "Paid"
                          }
                          size="small"
                          color={
                            payment.status === "Paid"
                              ? "success"
                              : "warning"
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {payment.remarks || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

      </Container>
    </Box>
  );
}