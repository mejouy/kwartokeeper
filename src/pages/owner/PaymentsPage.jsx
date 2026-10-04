import React, { useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import PaymentsIcon from "@mui/icons-material/Payments";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

export default function PaymentsPage() {
  const { currentUser } = useAuth() || {};

  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openRecordPayment, setOpenRecordPayment] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    tenantId: "",
    amount: "",
    paymentMethod: "GCash",
    periodMonth: "",
    status: "Paid",
    paymentDate: "",
    remarks: "",
  });

  // ------------------------------------------------------------
  // CURRENT BILLING PERIOD
  // ------------------------------------------------------------

  const currentBillingPeriod = useMemo(() => {
    const now = new Date();

    return now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, []);

  const currentPeriodValue = useMemo(() => {
    const now = new Date();

    return now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, []);

  // ------------------------------------------------------------
  // LOAD TENANTS AND PAYMENTS
  // ------------------------------------------------------------

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const tenantsQuery = query(
      collection(db, "tenants"),
      where("ownerUid", "==", currentUser.uid)
    );

    const paymentsQuery = query(
      collection(db, "payments"),
      where("ownerUid", "==", currentUser.uid)
    );

    const unsubscribeTenants = onSnapshot(
      tenantsQuery,
      (snapshot) => {
        const tenantData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setTenants(tenantData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading tenants:", error);
        setLoading(false);
      }
    );

    const unsubscribePayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const paymentData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setPayments(paymentData);
      },
      (error) => {
        console.error("Error loading payments:", error);
      }
    );

    return () => {
      unsubscribeTenants();
      unsubscribePayments();
    };
  }, [currentUser]);

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  const normalizeTenant = (tenant) => ({
    ...tenant,

    fullName:
      tenant.fullName ||
      tenant.name ||
      "Unnamed Tenant",

    roomNumber:
      tenant.roomNumber ||
      tenant.roomId ||
      "Unassigned",

    propertyName:
      tenant.propertyName ||
      "Dormitory",

    monthlyRent:
      Number(
        tenant.monthlyRent ??
          tenant.rentAmount ??
          tenant.monthlyRate ??
          tenant.rent ??
          0
      ) || 0,

    status:
      tenant.status ||
      "Active",
  });

  const normalizedTenants = useMemo(() => {
    return tenants.map(normalizeTenant);
  }, [tenants]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const getPaymentDate = (payment) => {
    const value = payment.paymentDate || payment.createdAt;

    if (!value) return null;

    if (typeof value?.toDate === "function") {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  };

  const formatDate = (payment) => {
    const date = getPaymentDate(payment);

    if (!date) return "—";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isCurrentMonth = (payment) => {
    const date = getPaymentDate(payment);

    if (!date) {
      return payment.periodMonth === currentPeriodValue;
    }

    const now = new Date();

    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  const getPaymentStatus = (payment) => {
    return String(payment.status || "").toLowerCase();
  };

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------

  const totalRentCollectedThisMonth = useMemo(() => {
    return payments
      .filter(
        (payment) =>
          isCurrentMonth(payment) &&
          getPaymentStatus(payment) === "paid"
      )
      .reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
      );
  }, [payments, currentPeriodValue]);

  const expectedRent = useMemo(() => {
    return normalizedTenants
      .filter(
        (tenant) =>
          String(tenant.status).toLowerCase() !== "inactive" &&
          String(tenant.status).toLowerCase() !== "pending"
      )
      .reduce(
        (total, tenant) => total + Number(tenant.monthlyRent || 0),
        0
      );
  }, [normalizedTenants]);

  const pendingPayments = useMemo(() => {
    return payments.filter((payment) => {
      const status = getPaymentStatus(payment);

      return (
        status === "pending" ||
        status === "partial"
      );
    }).length;
  }, [payments]);

  const overduePayments = useMemo(() => {
    return payments.filter(
      (payment) => getPaymentStatus(payment) === "overdue"
    ).length;
  }, [payments]);

  // ------------------------------------------------------------
  // PENDING PAYMENT VERIFICATION
  // ------------------------------------------------------------

  const pendingVerificationPayments = useMemo(() => {
    return [...payments]
      .filter((payment) => {
        const status = getPaymentStatus(payment);
        const verificationStatus = String(
          payment.verificationStatus || ""
        ).toLowerCase();

        return status === "pending" || verificationStatus === "pending";
      })
      .sort((a, b) => {
        const dateA = getPaymentDate(a)?.getTime() || 0;
        const dateB = getPaymentDate(b)?.getTime() || 0;
        return dateB - dateA;
      });
  }, [payments]);

  // ------------------------------------------------------------
  // ROOM-BASED PAYMENT MANAGEMENT
  // ------------------------------------------------------------

  const roomGroups = useMemo(() => {
    const groups = {};

    normalizedTenants.forEach((tenant) => {
      const roomNumber = tenant.roomNumber || "Unassigned";

      if (!groups[roomNumber]) {
        groups[roomNumber] = {
          roomNumber,
          propertyName: tenant.propertyName || "Dormitory",
          tenants: [],
          collected: 0,
          expected: 0,
        };
      }

      groups[roomNumber].tenants.push(tenant);

      groups[roomNumber].expected += Number(
        tenant.monthlyRent || 0
      );

      const tenantPayments = payments.filter(
        (payment) =>
          payment.tenantId === tenant.id &&
          payment.periodMonth === currentPeriodValue
      );

      const paidAmount = tenantPayments
        .filter(
          (payment) =>
            getPaymentStatus(payment) === "paid"
        )
        .reduce(
          (total, payment) =>
            total + Number(payment.amount || 0),
          0
        );

      groups[roomNumber].collected += paidAmount;
    });

    return Object.values(groups).sort((a, b) =>
      String(a.roomNumber).localeCompare(
        String(b.roomNumber),
        undefined,
        { numeric: true }
      )
    );
  }, [normalizedTenants, payments, currentPeriodValue]);

  // ------------------------------------------------------------
  // PAYMENT STATUS FOR TENANT
  // ------------------------------------------------------------

  const getTenantPaymentInfo = (tenant) => {
    const tenantPayments = payments.filter(
      (payment) =>
        payment.tenantId === tenant.id &&
        payment.periodMonth === currentPeriodValue
    );

    const paidAmount = tenantPayments
      .filter(
        (payment) =>
          getPaymentStatus(payment) === "paid"
      )
      .reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0
      );

    const latestPayment = [...tenantPayments].sort((a, b) => {
      const dateA = getPaymentDate(a)?.getTime() || 0;
      const dateB = getPaymentDate(b)?.getTime() || 0;

      return dateB - dateA;
    })[0];

    const rent = Number(tenant.monthlyRent || 0);

    let status = "Unpaid";

    if (latestPayment) {
      const paymentStatus = getPaymentStatus(latestPayment);

      if (paymentStatus === "overdue") {
        status = "Overdue";
      } else if (paidAmount >= rent && rent > 0) {
        status = "Paid";
      } else if (paidAmount > 0) {
        status = "Partial";
      } else if (paymentStatus === "pending") {
        status = "Pending";
      }
    }

    return {
      paidAmount,
      rent,
      balance: Math.max(rent - paidAmount, 0),
      status,
      latestPayment,
    };
  };

  // ------------------------------------------------------------
  // PAYMENT VERIFICATION
  // ------------------------------------------------------------

  const handleVerifyPayment = async (paymentId, approved) => {
    if (!currentUser?.uid || !paymentId) {
      alert("Unable to update this payment.");
      return;
    }

    const payment = payments.find((item) => item.id === paymentId);

    if (!payment) {
      alert("Payment could not be found.");
      return;
    }

    if (payment.ownerUid && payment.ownerUid !== currentUser.uid) {
      alert("You are not authorized to update this payment.");
      return;
    }

    setProcessingPaymentId(paymentId);

    try {
      await updateDoc(doc(db, "payments", paymentId), {
        status: approved ? "Paid" : "Rejected",
        verificationStatus: approved ? "Approved" : "Rejected",
        verifiedAt: new Date(),
        verifiedBy: currentUser.uid,
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      alert(
        approved
          ? "Failed to approve the payment. Please try again."
          : "Failed to reject the payment. Please try again."
      );
    } finally {
      setProcessingPaymentId("");
    }
  };

  // ------------------------------------------------------------
  // RECORD PAYMENT
  // ------------------------------------------------------------

  const handleOpenRecordPayment = () => {
    const today = new Date().toISOString().split("T")[0];

    setPaymentForm({
      tenantId: "",
      amount: "",
      paymentMethod: "GCash",
      periodMonth: currentPeriodValue,
      status: "Paid",
      paymentDate: today,
      remarks: "",
    });

    setOpenRecordPayment(true);
  };

  const handleCloseRecordPayment = () => {
    setOpenRecordPayment(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setPaymentForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRecordPayment = async () => {
    if (!currentUser?.uid) {
      alert("You must be logged in to record a payment.");
      return;
    }

    if (!paymentForm.tenantId) {
      alert("Please select a tenant.");
      return;
    }

    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const selectedTenant = normalizedTenants.find(
      (tenant) => tenant.id === paymentForm.tenantId
    );

    if (!selectedTenant) {
      alert("Selected tenant could not be found.");
      return;
    }

    try {
      await addDoc(collection(db, "payments"), {
        tenantId: selectedTenant.id,

        tenantName: selectedTenant.fullName,

        propertyId:
          selectedTenant.propertyId ||
          selectedTenant.assignedPropertyId ||
          "",

        propertyName:
          selectedTenant.propertyName ||
          "Dormitory",

        roomNumber:
          selectedTenant.roomNumber ||
          "N/A",

        amount: Number(paymentForm.amount),

        paymentMethod:
          paymentForm.paymentMethod,

        periodMonth:
          paymentForm.periodMonth,

        status:
          paymentForm.status,

        verificationStatus:
          paymentForm.status === "Paid"
            ? "Approved"
            : paymentForm.status === "Pending"
              ? "Pending"
              : "",

        remarks:
          paymentForm.remarks.trim(),

        ownerUid:
          currentUser.uid,

        paymentDate:
          paymentForm.paymentDate
            ? new Date(`${paymentForm.paymentDate}T12:00:00`)
            : new Date(),

        createdAt:
          serverTimestamp(),
      });

      setOpenRecordPayment(false);

      setPaymentForm({
        tenantId: "",
        amount: "",
        paymentMethod: "GCash",
        periodMonth: currentPeriodValue,
        status: "Paid",
        paymentDate: "",
        remarks: "",
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      alert("Failed to record payment. Please try again.");
    }
  };

  // ------------------------------------------------------------
  // STATUS CHIP
  // ------------------------------------------------------------

  const renderStatusChip = (status) => {
    const normalizedStatus = String(status).toLowerCase();

    let color = "default";

    if (normalizedStatus === "paid") {
      color = "success";
    } else if (normalizedStatus === "pending") {
      color = "warning";
    } else if (normalizedStatus === "overdue") {
      color = "error";
    } else if (normalizedStatus === "partial") {
      color = "info";
    } else if (normalizedStatus === "unpaid") {
      color = "default";
    } else if (normalizedStatus === "rejected") {
      color = "error";
    }

    return (
      <Chip
        label={status}
        color={color}
        size="small"
        variant="outlined"
      />
    );
  };

  // ------------------------------------------------------------
  // LOADING
  // ------------------------------------------------------------

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* PAGE HEADER */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ mb: 0.5 }}
          >
            Payments & Rent
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Monitor rent collection and payment status by room.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenRecordPayment}
        >
          Record Payment
        </Button>
      </Box>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ mb: 2 }}
      >
        Summary
      </Typography>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {/* TOTAL COLLECTED */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Total Rent Collected This Month
                  </Typography>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ mt: 1 }}
                  >
                    {formatCurrency(
                      totalRentCollectedThisMonth
                    )}
                  </Typography>
                </Box>

                <PaymentsIcon color="primary" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* EXPECTED RENT */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Expected Rent
                  </Typography>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ mt: 1 }}
                  >
                    {formatCurrency(expectedRent)}
                  </Typography>
                </Box>

                <AccountBalanceWalletIcon color="primary" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* PENDING */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Pending Payments
                  </Typography>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ mt: 1 }}
                  >
                    {pendingPayments}
                  </Typography>
                </Box>

                <PendingActionsIcon color="warning" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* OVERDUE */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Overdue Payments
                  </Typography>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ mt: 1 }}
                  >
                    {overduePayments}
                  </Typography>
                </Box>

                <WarningAmberIcon color="error" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ======================================================
          PENDING PAYMENT VERIFICATION
      ====================================================== */}

      {pendingVerificationPayments.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Pending Payment Verification
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review payment submissions made by tenants before marking them as paid.
          </Typography>

          <Stack spacing={2}>
            {pendingVerificationPayments.map((payment) => {
              const isProcessing = processingPaymentId === payment.id;

              return (
                <Card
                  key={payment.id}
                  elevation={0}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: { xs: "flex-start", md: "center" },
                        flexDirection: { xs: "column", md: "row" },
                        gap: 2,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={700}>
                          {payment.tenantName || "Unnamed Tenant"}
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          Room {payment.roomNumber || "Unassigned"} •{" "}
                          {payment.propertyName || "Dormitory"}
                        </Typography>

                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 1 }}
                        >
                          {renderStatusChip("Pending")}

                          <Chip
                            label={payment.paymentMethod || "Unknown Method"}
                            size="small"
                            variant="outlined"
                          />

                          <Chip
                            label={payment.periodMonth || "No billing period"}
                            size="small"
                            variant="outlined"
                          />
                        </Stack>
                      </Box>

                      <Box
                        sx={{
                          minWidth: { md: 180 },
                          textAlign: { xs: "left", md: "right" },
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Amount
                        </Typography>

                        <Typography variant="h6" fontWeight={700}>
                          {formatCurrency(payment.amount)}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                          {formatDate(payment)}
                        </Typography>
                      </Box>

                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ width: { xs: "100%", md: "auto" } }}
                      >
                        <Button
                          variant="contained"
                          color="success"
                          disabled={isProcessing}
                          onClick={() => handleVerifyPayment(payment.id, true)}
                        >
                          {isProcessing ? "Updating..." : "Approve"}
                        </Button>

                        <Button
                          variant="outlined"
                          color="error"
                          disabled={isProcessing}
                          onClick={() => handleVerifyPayment(payment.id, false)}
                        >
                          Reject
                        </Button>
                      </Stack>
                    </Box>

                    {(payment.referenceNumber || payment.remarks) && (
                      <>
                        <Divider sx={{ my: 2 }} />

                        <Stack spacing={0.5}>
                          {payment.referenceNumber && (
                            <Typography variant="body2">
                              <strong>Reference:</strong>{" "}
                              {payment.referenceNumber}
                            </Typography>
                          )}

                          {payment.remarks && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Remarks:</strong> {payment.remarks}
                            </Typography>
                          )}
                        </Stack>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* ======================================================
          PAYMENT MANAGEMENT
      ====================================================== */}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography
            variant="h6"
            fontWeight={700}
          >
            Payment Management
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            Billing period: {currentBillingPeriod}
          </Typography>
        </Box>
      </Box>

      {roomGroups.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <CardContent>
            <Box
              sx={{
                py: 6,
                textAlign: "center",
              }}
            >
              <MeetingRoomIcon
                sx={{
                  fontSize: 48,
                  color: "text.secondary",
                  mb: 1,
                }}
              />

              <Typography
                variant="h6"
                fontWeight={600}
              >
                No rooms available
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Add tenants with assigned rooms to view
                payment management.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2.5}>
          {roomGroups.map((room) => (
            <Card
              key={room.roomNumber}
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              {/* ROOM HEADER */}
              <Box
                sx={{
                  px: 2.5,
                  py: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: {
                    xs: "flex-start",
                    sm: "center",
                  },
                  flexDirection: {
                    xs: "column",
                    sm: "row",
                  },
                  gap: 1.5,
                  backgroundColor: "grey.50",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                >
                  <MeetingRoomIcon color="primary" />

                  <Box>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                    >
                      Room {room.roomNumber}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {room.propertyName}
                    </Typography>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    textAlign: {
                      xs: "left",
                      sm: "right",
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Amount Collected
                  </Typography>

                  <Typography
                    variant="h6"
                    fontWeight={700}
                  >
                    {formatCurrency(room.collected)}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              {/* ROOM TENANTS */}
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  {room.tenants.map((tenant) => {
                    const info =
                      getTenantPaymentInfo(tenant);

                    return (
                      <Box key={tenant.id}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: {
                              xs: "flex-start",
                              md: "center",
                            },
                            flexDirection: {
                              xs: "column",
                              md: "row",
                            },
                            gap: 2,
                          }}
                        >
                          <Box sx={{ minWidth: 180 }}>
                            <Typography
                              fontWeight={600}
                            >
                              {tenant.fullName}
                            </Typography>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {tenant.propertyName}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Monthly Rent
                            </Typography>

                            <Typography
                              fontWeight={600}
                            >
                              {formatCurrency(info.rent)}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Amount Collected
                            </Typography>

                            <Typography
                              fontWeight={600}
                            >
                              {formatCurrency(
                                info.paidAmount
                              )}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Balance
                            </Typography>

                            <Typography
                              fontWeight={600}
                            >
                              {formatCurrency(
                                info.balance
                              )}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "block",
                                mb: 0.5,
                              }}
                            >
                              Status
                            </Typography>

                            {renderStatusChip(
                              info.status
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* ROOM TOTAL */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Room Total
                  </Typography>

                  <Typography
                    fontWeight={700}
                  >
                    {formatCurrency(room.collected)}{" "}
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                    >
                      / {formatCurrency(room.expected)}
                    </Typography>
                  </Typography>
                </Box>
              </Box>
            </Card>
          ))}
        </Stack>
      )}

      {/* ======================================================
          RECORD PAYMENT MODAL
      ====================================================== */}

      <Dialog
        open={openRecordPayment}
        onClose={handleCloseRecordPayment}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Record Payment
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {/* TENANT */}
            <FormControl fullWidth>
              <InputLabel>
                Tenant
              </InputLabel>

              <Select
                name="tenantId"
                value={paymentForm.tenantId}
                label="Tenant"
                onChange={handleFormChange}
              >
                {normalizedTenants.map((tenant) => (
                  <MenuItem
                    key={tenant.id}
                    value={tenant.id}
                  >
                    {tenant.fullName} — Room{" "}
                    {tenant.roomNumber}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* AMOUNT */}
            <TextField
              fullWidth
              label="Amount"
              name="amount"
              type="number"
              value={paymentForm.amount}
              onChange={handleFormChange}
              inputProps={{
                min: 0,
                step: "0.01",
              }}
            />

            {/* PAYMENT METHOD */}
            <FormControl fullWidth>
              <InputLabel>
                Payment Method
              </InputLabel>

              <Select
                name="paymentMethod"
                value={paymentForm.paymentMethod}
                label="Payment Method"
                onChange={handleFormChange}
              >
                <MenuItem value="GCash">
                  GCash
                </MenuItem>

                <MenuItem value="Cash">
                  Cash
                </MenuItem>

                <MenuItem value="Bank Transfer">
                  Bank Transfer
                </MenuItem>

                <MenuItem value="Maya">
                  Maya
                </MenuItem>

                <MenuItem value="Other">
                  Other
                </MenuItem>
              </Select>
            </FormControl>

            {/* BILLING PERIOD */}
            <TextField
              fullWidth
              label="Billing Period"
              name="periodMonth"
              value={paymentForm.periodMonth}
              onChange={handleFormChange}
              placeholder="October 2026"
            />

            {/* PAYMENT DATE */}
            <TextField
              fullWidth
              label="Payment Date"
              name="paymentDate"
              type="date"
              value={paymentForm.paymentDate}
              onChange={handleFormChange}
              InputLabelProps={{
                shrink: true,
              }}
            />

            {/* STATUS */}
            <FormControl fullWidth>
              <InputLabel>
                Status
              </InputLabel>

              <Select
                name="status"
                value={paymentForm.status}
                label="Status"
                onChange={handleFormChange}
              >
                <MenuItem value="Paid">
                  Paid
                </MenuItem>

                <MenuItem value="Pending">
                  Pending
                </MenuItem>

                <MenuItem value="Partial">
                  Partial
                </MenuItem>

                <MenuItem value="Overdue">
                  Overdue
                </MenuItem>
              </Select>
            </FormControl>

            {/* REMARKS */}
            <TextField
              fullWidth
              label="Remarks"
              name="remarks"
              value={paymentForm.remarks}
              onChange={handleFormChange}
              multiline
              minRows={3}
              placeholder="Optional payment notes"
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseRecordPayment}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleRecordPayment}
          >
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}