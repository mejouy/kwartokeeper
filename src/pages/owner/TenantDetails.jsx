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
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import BadgeIcon from "@mui/icons-material/Badge";

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

  // =========================================================
  // DATE HELPER
  // =========================================================
  const getPaymentDate = (payment) => {
    const value =
      payment?.paymentDate ||
      payment?.createdAt;

    if (!value) {
      return null;
    }

    // Firestore Timestamp
    if (typeof value.toDate === "function") {
      return value.toDate();
    }

    // JavaScript Date
    if (value instanceof Date) {
      return value;
    }

    // String / number
    const parsed = new Date(value);

    return isNaN(parsed.getTime())
      ? null
      : parsed;
  };

  // =========================================================
  // FORMAT PAYMENT DATE
  // =========================================================
  const formatPaymentDate = (payment) => {
    const date = getPaymentDate(payment);

    if (!date) {
      return "Date not available";
    }

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // =========================================================
  // LOAD TENANT DETAILS + PAYMENTS
  // =========================================================
  useEffect(() => {
    const loadTenantDetails = async () => {
      if (!currentUser?.uid || !tenantId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // =====================================================
        // GET TENANTS
        // =====================================================
        const tenantsQuery = query(
          collection(db, "tenants"),
          where("ownerUid", "==", currentUser.uid)
        );

        const tenantsSnap = await getDocs(tenantsQuery);

        const tenantRecords = tenantsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // =====================================================
        // ALSO GET USERS
        // Some older tenant records may exist in users.
        // =====================================================
        const usersSnap = await getDocs(
          collection(db, "users")
        );

        const users = usersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // =====================================================
        // FIND TENANT
        // =====================================================
        const foundTenant =
          tenantRecords.find(
            (t) =>
              t.id === tenantId ||
              t.uid === tenantId
          ) ||
          users.find(
            (u) =>
              (u.id === tenantId ||
                u.uid === tenantId) &&
              (
                u.ownerUid === currentUser.uid ||
                u.invitedBy === currentUser.uid ||
                u.ownerId === currentUser.uid
              )
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
              foundTenant.property ||
              "Dormitory",

            roomNumber:
              foundTenant.roomNumber ||
              foundTenant.roomId ||
              "",

            bedNumber:
              foundTenant.bedNumber ||
              foundTenant.bedId ||
              "",

            status:
              foundTenant.status ||
              "Active",
          });
        }

        // =====================================================
        // LOAD PAYMENTS
        // =====================================================
        const paymentsQuery = query(
          collection(db, "payments"),
          where("ownerUid", "==", currentUser.uid)
        );

        const paymentsSnap = await getDocs(
          paymentsQuery
        );

        const tenantPayments = paymentsSnap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(
            (payment) =>
              payment.tenantId === tenantId
          );

        // =====================================================
        // SORT NEWEST PAYMENT FIRST
        // =====================================================
        tenantPayments.sort((a, b) => {
          const dateA = getPaymentDate(a);
          const dateB = getPaymentDate(b);

          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;

          return (
            dateB.getTime() -
            dateA.getTime()
          );
        });

        setPayments(tenantPayments);
      } catch (error) {
        console.error(
          "Error loading tenant details:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadTenantDetails();
  }, [tenantId, currentUser]);

  // =========================================================
  // LOADING
  // =========================================================
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

  // =========================================================
  // TENANT NOT FOUND
  // =========================================================
  if (!tenant) {
    return (
      <Container
        maxWidth="lg"
        sx={{ py: 4 }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate("/owner/tenants")
          }
          sx={{ mb: 3 }}
        >
          Back to Tenants
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

  // =========================================================
  // PAYMENT SUMMARY
  // =========================================================
  const totalAmountPaid = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  const lastPayment =
    payments.length > 0
      ? payments[0]
      : null;

  // =========================================================
  // PAGE
  // =========================================================
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <Container
        maxWidth="lg"
        sx={{ py: 4 }}
      >
        {/* ===================================================
            BACK BUTTON
        =================================================== */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate("/owner/tenants")
          }
          sx={{ mb: 3 }}
        >
          Back to Tenants
        </Button>

        {/* ===================================================
            PAGE HEADER
        =================================================== */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h4"
            fontWeight="700"
          >
            Tenant Details
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Complete tenant information and payment history.
          </Typography>
        </Box>

        {/* ===================================================
            TENANT INFORMATION
        =================================================== */}
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
          {/* PROFILE HEADER */}
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={3}
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
          >
            {/* PROFILE ICON */}
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
                flexShrink: 0,
              }}
            >
              <PersonIcon fontSize="large" />
            </Box>

            {/* NAME */}
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

            {/* STATUS */}
            <Chip
              label={tenant.status}
              color={
                tenant.status ===
                "Pending Onboarding"
                  ? "warning"
                  : tenant.status === "Inactive"
                  ? "default"
                  : "success"
              }
            />
          </Stack>

          <Divider sx={{ my: 3 }} />

          {/* =================================================
              TENANT DETAILS GRID
          ================================================= */}
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
            {/* PROPERTY */}
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

            {/* ROOM */}
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

            {/* BED */}
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Bed
              </Typography>

              <Typography
                fontWeight="600"
                sx={{ mt: 0.5 }}
              >
                {tenant.bedNumber ||
                  "Not assigned"}
              </Typography>
            </Box>

            {/* EMAIL */}
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Email
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 0.5 }}
              >
                <EmailIcon fontSize="small" />

                <Typography
                  fontWeight="600"
                  sx={{
                    wordBreak: "break-word",
                  }}
                >
                  {tenant.email ||
                    "Not provided"}
                </Typography>
              </Stack>
            </Box>

            {/* PHONE */}
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Phone
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 0.5 }}
              >
                <PhoneIcon fontSize="small" />

                <Typography fontWeight="600">
                  {tenant.phone ||
                    tenant.contactNumber ||
                    "Not provided"}
                </Typography>
              </Stack>
            </Box>

            {/* ID TYPE */}
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Identification
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 0.5 }}
              >
                <BadgeIcon fontSize="small" />

                <Typography fontWeight="600">
                  {tenant.idType
                    ? tenant.idType
                        .replaceAll("_", " ")
                        .toUpperCase()
                    : "Not provided"}
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Paper>

        {/* ===================================================
            PAYMENT SUMMARY
        =================================================== */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1fr 1fr 1fr",
            },
            gap: 2,
            mb: 3,
          }}
        >
          {/* TOTAL PAYMENTS */}
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

          {/* TOTAL AMOUNT */}
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
              {totalAmountPaid.toLocaleString()}
            </Typography>
          </Paper>

          {/* LAST PAYMENT */}
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
              Last Payment
            </Typography>

            {lastPayment ? (
              <>
                <Typography
                  variant="h6"
                  fontWeight="700"
                  sx={{ mt: 1 }}
                >
                  ₱
                  {Number(
                    lastPayment.amount || 0
                  ).toLocaleString()}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  {formatPaymentDate(
                    lastPayment
                  )}
                </Typography>
              </>
            ) : (
              <Typography
                variant="h6"
                fontWeight="700"
                sx={{ mt: 1 }}
              >
                No payment
              </Typography>
            )}
          </Paper>
        </Box>

        {/* ===================================================
            PAYMENT HISTORY
        =================================================== */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          {/* PAYMENT HEADER */}
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
                Complete payment records for this tenant.
              </Typography>
            </Box>
          </Stack>

          {/* PAYMENT TABLE */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Payment Date</strong>
                  </TableCell>

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
                      colSpan={6}
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
                      {/* PAYMENT DATE */}
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight="600"
                        >
                          {formatPaymentDate(
                            payment
                          )}
                        </Typography>
                      </TableCell>

                      {/* BILLING PERIOD */}
                      <TableCell>
                        {payment.periodMonth ||
                          "N/A"}
                      </TableCell>

                      {/* AMOUNT */}
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

                      {/* METHOD */}
                      <TableCell>
                        {payment.paymentMethod ||
                          "N/A"}
                      </TableCell>

                      {/* STATUS */}
                      <TableCell>
                        <Chip
                          label={
                            payment.status ||
                            "Paid"
                          }
                          size="small"
                          color={
                            payment.status ===
                            "Paid"
                              ? "success"
                              : payment.status ===
                                "Overdue"
                              ? "error"
                              : "warning"
                          }
                        />
                      </TableCell>

                      {/* REMARKS */}
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