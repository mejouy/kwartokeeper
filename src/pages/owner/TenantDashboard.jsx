import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Divider,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
} from "@mui/material";

import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import LogoutIcon from "@mui/icons-material/Logout";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AddIcon from "@mui/icons-material/Add";
import PaymentIcon from "@mui/icons-material/Payment";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import HistoryIcon from "@mui/icons-material/History";

import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { QRCodeCanvas } from "qrcode.react";

import {
  CATEGORIES,
  rankMaintenanceRequests,
} from "../../utils/maintenancePrioritization";

const CATEGORY_OPTIONS = [
  {
    value: CATEGORIES.SAFETY,
    label: "Safety (e.g. exposed wiring, broken lock)",
  },
  {
    value: CATEGORIES.UTILITY,
    label: "Utility (e.g. clogged drain, appliance issue)",
  },
  {
    value: CATEGORIES.ROUTINE,
    label: "Routine (e.g. paint chip, cosmetic issue)",
  },
];

const TIER_CHIP_COLOR = {
  High: "error",
  Medium: "warning",
  Low: "default",
};

/*
|--------------------------------------------------------------------------
| DRAFT PAYMENT SETTINGS
|--------------------------------------------------------------------------
| These are temporary values for development/demo purposes.
|
| Before your defense:
| - Replace the GCash account details
| - Replace the Maya account details
| - Replace the bank details
| - Eventually move these settings to the owner's account/settings
|--------------------------------------------------------------------------
*/

const DRAFT_PAYMENT_METHODS = {
  GCash: {
    enabled: true,
    accountName: "KwartoKeeper Owner",
    accountNumber: "09XX-XXX-XXXX",

    // Temporary QR content.
    // This generates a real QR code, but it is NOT a real payment QR yet.
    qrValue:
      "GCash DRAFT PAYMENT - Replace this QR with the owner's real GCash QR before defense",
  },

  Maya: {
    enabled: true,
    accountName: "KwartoKeeper Owner",
    accountNumber: "09XX-XXX-XXXX",

    qrValue:
      "Maya DRAFT PAYMENT - Replace this QR with the owner's real Maya QR before defense",
  },

  "Bank Transfer": {
    enabled: true,
    bankName: "Sample Bank",
    accountName: "KwartoKeeper Owner",
    accountNumber: "XXXX-XXXX-XXXX",

    qrValue:
      "BANK TRANSFER DRAFT - Replace with actual bank details before defense",
  },

  Cash: {
    enabled: true,
    instructions:
      "Submit this request after handing the cash payment to the owner or caretaker. The payment will remain pending until it is verified.",
  },
};

export default function TenantDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // -------------------------------------------------------------------------
  // TENANT INFORMATION
  // -------------------------------------------------------------------------

  const [tenantInfo, setTenantInfo] = useState({
    name: "Tenant",
    propertyName: "Not Assigned",
    roomNumber: "N/A",
    bedId: "N/A",
    monthlyRent: 0,
    status: "Active",
    leaseStartDate: "Not specified",
    leaseDuration: "Not specified",
    contact: "None provided",
    ownerUid: "",
    propertyId: "",
    rentDueDay: 5,
  });

  // -------------------------------------------------------------------------
  // MAINTENANCE
  // -------------------------------------------------------------------------

  const [tickets, setTickets] = useState([]);

  const [openRepairModal, setOpenRepairModal] = useState(false);

  const [repairForm, setRepairForm] = useState({
    title: "",
    description: "",
    category: CATEGORIES.SAFETY,
  });

  // -------------------------------------------------------------------------
  // PAYMENTS
  // -------------------------------------------------------------------------

  const [payments, setPayments] = useState([]);

  const [openPaymentModal, setOpenPaymentModal] = useState(false);

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState("GCash");

  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    referenceNumber: "",
    paymentDate: getTodayInputValue(),
    remarks: "",
  });

  const [paymentMessage, setPaymentMessage] = useState({
    type: "",
    text: "",
  });

  // -------------------------------------------------------------------------
  // CURRENT BILLING PERIOD
  // -------------------------------------------------------------------------

  const currentPeriod = useMemo(() => {
    const now = new Date();

    return now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, []);

  // -------------------------------------------------------------------------
  // RENT DUE DATE
  // -------------------------------------------------------------------------

  const dueDateLabel = useMemo(() => {
    const now = new Date();

    const day = Math.min(
      Math.max(Number(tenantInfo.rentDueDay || 5), 1),
      28
    );

    const dueDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      day
    );

    return dueDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [tenantInfo.rentDueDay]);

  // -------------------------------------------------------------------------
  // CURRENT MONTH PAYMENT
  // -------------------------------------------------------------------------

  const currentPeriodPayment = useMemo(() => {
    const periodPayments = payments.filter(
      (payment) => payment.periodMonth === currentPeriod
    );

    // Paid takes priority over Pending.
    if (
      periodPayments.some(
        (payment) => payment.status === "Paid"
      )
    ) {
      return periodPayments.find(
        (payment) => payment.status === "Paid"
      );
    }

    return periodPayments[0] || null;
  }, [payments, currentPeriod]);

  const rentStatus =
    currentPeriodPayment?.status || "Unpaid";

  // -------------------------------------------------------------------------
  // LOAD TENANT INFORMATION
  // -------------------------------------------------------------------------

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);

        // ---------------------------------------------------------------
        // Fetch tenant profile
        // ---------------------------------------------------------------

        const userDoc = await getDoc(
          doc(db, "users", user.uid)
        );

        if (userDoc.exists()) {
          const data = userDoc.data();

          const propertyId =
            data.propertyId ||
            data.assignedPropertyId;

          let propertyName = "Not Assigned";

          // -------------------------------------------------------------
          // Fetch property
          // -------------------------------------------------------------

          let propertyData = null;
let assignedRoom = null;

if (propertyId) {
  try {
    const propDoc = await getDoc(
      doc(db, "properties", propertyId)
    );

    if (propDoc.exists()) {
      propertyData = propDoc.data();

      propertyName =
        propertyData.propertyName ||
        propertyData.name ||
        propertyData.title ||
        "Facility Name Unavailable";

      // -----------------------------------------------------------
      // Find the tenant's assigned room
      // -----------------------------------------------------------

      const rooms = Array.isArray(
        propertyData.rooms
      )
        ? propertyData.rooms
        : [];

      assignedRoom = rooms.find(
        (room) =>
          room.roomName ===
            data.roomId ||
          room.id === data.roomId
      );

      console.log(
        "Tenant room ID:",
        data.roomId
      );

      console.log(
        "Assigned room:",
        assignedRoom
      );
    }
  } catch (propErr) {
    console.error(
      "Error fetching property doc:",
      propErr
    );
  }
}

          // -------------------------------------------------------------
          // Set tenant information
          // -------------------------------------------------------------

          setTenantInfo({
  name:
    data.name ||
    data.fullName ||
    "Tenant",

  propertyName,

  // Your database uses roomId = "A2"
  roomNumber:
    assignedRoom?.roomName ||
    data.roomId ||
    "N/A",

  bedId:
    data.bedId ||
    "N/A",

  // Rent comes from the assigned room
  monthlyRent:
    Number(
      assignedRoom?.monthlyRatePerBed ||
        0
    ),

  status:
    data.status ||
    "Active",

  leaseStartDate:
    data.leaseStartDate ||
    data.moveInDate ||
    "Not specified",

  leaseDuration:
    formatLeaseDuration(
      data.leaseDuration
    ),

  contact:
    data.phone ||
    data.contact ||
    "None provided",

  ownerUid:
    data.ownerUid ||
    data.landlordUid ||
    data.invitedBy ||
    "",

  propertyId:
    propertyId || "",

  rentDueDay:
    Number(
      data.rentDueDay ||
        data.dueDay ||
        5
    ),
});
        }
      } catch (err) {
        console.error(
          "Error fetching tenant profile:",
          err
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // ---------------------------------------------------------------------
    // MAINTENANCE REALTIME LISTENER
    // ---------------------------------------------------------------------

    const qTickets = query(
      collection(db, "maintenance_tickets"),
      where("tenantUid", "==", user.uid)
    );

    const unsubscribeTickets = onSnapshot(
      qTickets,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setTickets(docs);
      }
    );

    // ---------------------------------------------------------------------
    // PAYMENT REALTIME LISTENER
    // ---------------------------------------------------------------------

    const qPayments = query(
      collection(db, "payments"),
      where("tenantId", "==", user.uid)
    );

    const unsubscribePayments = onSnapshot(
      qPayments,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        docs.sort(
          (a, b) =>
            getTimestampMillis(
              b.paymentDate || b.createdAt
            ) -
            getTimestampMillis(
              a.paymentDate || a.createdAt
            )
        );

        setPayments(docs);
      },
      (error) => {
        console.error(
          "Error listening to tenant payments:",
          error
        );
      }
    );

    return () => {
      unsubscribeTickets();
      unsubscribePayments();
    };
  }, [navigate]);

  // -------------------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------------------

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // MAINTENANCE SUBMISSION
  // -------------------------------------------------------------------------

  const handleRequestSubmit = async () => {
    const user = auth.currentUser;

    if (!user || !repairForm.title) {
      return;
    }

    try {
      await addDoc(
        collection(db, "maintenance_tickets"),
        {
          tenantUid: user.uid,

          tenantName:
            tenantInfo.name,

          ownerUid:
            tenantInfo.ownerUid,

          propertyId:
            tenantInfo.propertyId,

          propertyName:
            tenantInfo.propertyName,

          roomNumber:
            tenantInfo.roomNumber,

          title:
            repairForm.title,

          description:
            repairForm.description,

          category:
            repairForm.category,

          status:
            "Pending",

          createdAt:
            serverTimestamp(),
        }
      );

      setOpenRepairModal(false);

      setRepairForm({
        title: "",
        description: "",
        category: CATEGORIES.SAFETY,
      });
    } catch (err) {
      console.error(
        "Error submitting repair request:",
        err
      );
    }
  };

  // -------------------------------------------------------------------------
  // OPEN PAYMENT MODAL
  // -------------------------------------------------------------------------

  const openPayRentModal = () => {
    setPaymentMessage({
      type: "",
      text: "",
    });

    setSelectedPaymentMethod("GCash");

    setPaymentForm({
      amount: String(
        tenantInfo.monthlyRent || ""
      ),

      referenceNumber: "",

      paymentDate:
        getTodayInputValue(),

      remarks: "",
    });

    setOpenPaymentModal(true);
  };

  // -------------------------------------------------------------------------
  // SUBMIT PAYMENT
  // -------------------------------------------------------------------------

  const handlePaymentSubmit = async () => {
    const user = auth.currentUser;

    const amount =
      Number(paymentForm.amount);

    if (!user) {
      return;
    }

    // ---------------------------------------------------------------
    // Validate amount
    // ---------------------------------------------------------------

    if (!amount || amount <= 0) {
      setPaymentMessage({
        type: "error",
        text: "Please enter a valid payment amount.",
      });

      return;
    }

    // ---------------------------------------------------------------
    // Validate reference number
    // ---------------------------------------------------------------

    if (
      selectedPaymentMethod !== "Cash" &&
      !paymentForm.referenceNumber.trim()
    ) {
      setPaymentMessage({
        type: "error",
        text: "Please enter the payment reference number.",
      });

      return;
    }

    // ---------------------------------------------------------------
    // Validate owner relationship
    // ---------------------------------------------------------------

    if (!tenantInfo.ownerUid) {
      setPaymentMessage({
        type: "error",
        text:
          "Your account is not linked to an owner yet. Please contact the property owner.",
      });

      return;
    }

    try {
      setPaymentSubmitting(true);

      setPaymentMessage({
        type: "",
        text: "",
      });

      // -------------------------------------------------------------
      // CREATE PAYMENT
      // -------------------------------------------------------------

      await addDoc(
        collection(db, "payments"),
        {
          tenantId:
            user.uid,

          tenantName:
            tenantInfo.name,

          ownerUid:
            tenantInfo.ownerUid,

          propertyId:
            tenantInfo.propertyId,

          propertyName:
            tenantInfo.propertyName,

          roomNumber:
            tenantInfo.roomNumber,

          amount,

          paymentMethod:
            selectedPaymentMethod,

          periodMonth:
            currentPeriod,

          // IMPORTANT:
          // Tenant cannot make this Paid.
          status:
            "Pending",

          verificationStatus:
            "Pending",

          referenceNumber:
            paymentForm.referenceNumber.trim(),

          paymentDate:
            paymentForm.paymentDate,

          remarks:
            paymentForm.remarks.trim(),

          createdAt:
            serverTimestamp(),
        }
      );

      setPaymentMessage({
        type: "success",
        text:
          "Payment submitted successfully. It is now pending owner verification.",
      });

      setPaymentForm({
        amount: String(
          tenantInfo.monthlyRent || ""
        ),

        referenceNumber: "",

        paymentDate:
          getTodayInputValue(),

        remarks: "",
      });
    } catch (err) {
      console.error(
        "Error submitting payment:",
        err
      );

      setPaymentMessage({
        type: "error",
        text:
          "Unable to submit the payment right now. Please try again.",
      });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // LOADING
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const rankedTickets =
    rankMaintenanceRequests(tickets);

  const selectedMethodDetails =
    DRAFT_PAYMENT_METHODS[
      selectedPaymentMethod
    ];

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8fafc",
      }}
    >
      {/* ================================================================
          NAVBAR
      ================================================================= */}

      <AppBar
        position="static"
        color="default"
        elevation={1}
        sx={{
          bgcolor: "#ffffff",
        }}
      >
        <Toolbar
          sx={{
            justifyContent:
              "space-between",
          }}
        >
          <Typography
            variant="h6"
            fontWeight="800"
            color="primary"
          >
            KwartoKeeper
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "center" }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              fontWeight="600"
            >
              {tenantInfo.name} (
              {tenantInfo.propertyName})
            </Typography>

            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={
                <LogoutIcon />
              }
              onClick={
                handleLogout
              }
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="xl"
        sx={{
          py: 4,
        }}
      >
        {/* ==============================================================
            WELCOME
        ============================================================== */}

        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            fontWeight="800"
          >
            Welcome back,{" "}
            {tenantInfo.name}!
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Tenant Portal — Account
            &amp; Lease Overview
          </Typography>
        </Box>

        {/* ==============================================================
            METRICS
        ============================================================== */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, 1fr)",
            },
            gap: 2.5,
            mb: 4,
          }}
        >
          <Card
            elevation={0}
            sx={metricCardSx}
          >
            <CardContent
              sx={{ p: 2.5 }}
            >
              <Box
                sx={metricHeaderSx}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="600"
                >
                  Assigned Unit &amp;
                  Space
                </Typography>

                <MeetingRoomIcon
                  color="primary"
                />
              </Box>

              <Typography
                variant="h5"
                fontWeight="800"
              >
                Room{" "}
                {tenantInfo.roomNumber}
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Facility:{" "}
                {
                  tenantInfo.propertyName
                }
              </Typography>
            </CardContent>
          </Card>

          <Card
            elevation={0}
            sx={metricCardSx}
          >
            <CardContent
              sx={{ p: 2.5 }}
            >
              <Box
                sx={metricHeaderSx}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="600"
                >
                  Monthly Rent Rate
                </Typography>

                <ReceiptLongIcon
                  color="success"
                />
              </Box>

              <Typography
                variant="h5"
                fontWeight="800"
                color="success.main"
              >
                ₱
                {Number(
                  tenantInfo.monthlyRent ||
                    0
                ).toLocaleString()}
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Standard monthly rate
              </Typography>
            </CardContent>
          </Card>

          <Card
            elevation={0}
            sx={metricCardSx}
          >
            <CardContent
              sx={{ p: 2.5 }}
            >
              <Box
                sx={metricHeaderSx}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="600"
                >
                  Lease Duration
                </Typography>

                <CalendarMonthIcon
                  color="info"
                />
              </Box>

              <Typography
                variant="h5"
                fontWeight="800"
              >
                {
                  tenantInfo.leaseDuration
                }
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Started:{" "}
                {
                  tenantInfo.leaseStartDate
                }
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* ==============================================================
            RENT PAYMENT
        ============================================================== */}

        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor:
              "divider",
            borderRadius: 3,
            mb: 3,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: {
                xs: "flex-start",
                sm: "center",
              },
              flexDirection: {
                xs: "column",
                sm: "row",
              },
              gap: 2,
              mb: 2.5,
            }}
          >
            <Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center" }}
              >
                <PaymentIcon color="primary" />

                <Typography
                  variant="h6"
                  fontWeight="700"
                >
                  Rent Payment
                </Typography>
              </Stack>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Pay your current rent
                and submit it for
                owner verification.
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={
                <PaymentIcon />
              }
              onClick={
                openPayRentModal
              }
            >
              Pay Rent
            </Button>
          </Box>

          {/* PAYMENT SUMMARY */}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(4, 1fr)",
              },
              gap: 2,
            }}
          >
            <PaymentInfoBox
              label="Billing Period"
              value={
                currentPeriod
              }
              icon={
                <CalendarMonthIcon
                  color="primary"
                />
              }
            />

            <PaymentInfoBox
              label="Amount Due"
              value={`₱${Number(
                tenantInfo.monthlyRent ||
                  0
              ).toLocaleString()}`}
              icon={
                <ReceiptLongIcon
                  color="success"
                />
              }
            />

            <PaymentInfoBox
              label="Due Date"
              value={
                dueDateLabel
              }
              icon={
                <CalendarMonthIcon
                  color="warning"
                />
              }
            />

            <PaymentInfoBox
              label="Payment Status"
              value={
                rentStatus
              }
              icon={
                <PaymentIcon
                  color={
                    rentStatus ===
                    "Paid"
                      ? "success"
                      : "warning"
                  }
                />
              }
              chip
            />
          </Box>

          {currentPeriodPayment &&
            rentStatus !==
              "Paid" && (
              <Alert
                severity="info"
                sx={{ mt: 2 }}
              >
                Your{" "}
                {currentPeriod}{" "}
                payment is
                currently{" "}
                <strong>
                  {rentStatus}
                </strong>{" "}
                and is waiting for
                owner verification.
              </Alert>
            )}

          <Divider
            sx={{ my: 2.5 }}
          />

          {/* PAYMENT HISTORY */}

          <Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 1.5 }}
            >
              <HistoryIcon
                fontSize="small"
                color="action"
              />

              <Typography
                variant="subtitle1"
                fontWeight="700"
              >
                Recent Payment
                History
              </Typography>
            </Stack>

            {payments.length ===
            0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                No payment records
                yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {payments
                  .slice(0, 5)
                  .map(
                    (payment) => (
                      <Box
                        key={
                          payment.id
                        }
                        sx={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems: {
                            xs: "flex-start",
                            sm: "center",
                          },
                          gap: 2,
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor:
                            "background.default",
                          border:
                            "1px solid",
                          borderColor:
                            "divider",
                          flexDirection: {
                            xs: "column",
                            sm: "row",
                          },
                        }}
                      >
                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight="700"
                          >
                            {payment.periodMonth ||
                              "Payment"}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {payment.paymentMethod ||
                              "Unknown method"}{" "}
                            • Ref:{" "}
                            {payment.referenceNumber ||
                              "N/A"}
                          </Typography>
                        </Box>

                        <Stack
  direction="row"
  spacing={1}
  sx={{ alignItems: "center" }}
>
                          <Typography
                            variant="subtitle2"
                            fontWeight="800"
                          >
                            ₱
                            {Number(
                              payment.amount ||
                                0
                            ).toLocaleString()}
                          </Typography>

                          <Chip
                            label={
                              payment.status ||
                              "Pending"
                            }
                            size="small"
                            color={getPaymentChipColor(
                              payment.status
                            )}
                          />
                        </Stack>
                      </Box>
                    )
                  )}
              </Stack>
            )}
          </Box>
        </Paper>

        {/* ==============================================================
            RESIDENCY & LEASE
        ============================================================== */}

        <Paper
          elevation={0}
          sx={{
            ...sectionPaperSx,
            mb: 3,
          }}
        >
          <Box
            sx={sectionHeaderSx}
          >
            <Typography
              variant="h6"
              fontWeight="700"
            >
              Residency &amp; Lease
              Agreement
            </Typography>

            <Chip
              label={
                tenantInfo.status
              }
              color="success"
              size="small"
            />
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            mb={3}
          >
            Details associated
            with your registered
            lease account.
          </Typography>

          <Divider
            sx={{ mb: 3 }}
          />

          <Stack
  spacing={2}
  sx={{ maxWidth: "600px" }}
>
            <DetailRow
              label="Tenant Name:"
              value={
                tenantInfo.name
              }
            />

            <DetailRow
              label="Property Facility:"
              value={
                tenantInfo.propertyName
              }
            />

            <DetailRow
              label="Assigned Room:"
              value={`Room ${tenantInfo.roomNumber}`}
            />

            <DetailRow
              label="Bed Assignment:"
              value={
                tenantInfo.bedId
              }
            />

            <DetailRow
              label="Monthly Rent:"
              value={`₱${Number(
                tenantInfo.monthlyRent ||
                  0
              ).toLocaleString()}`}
              valueColor="success.main"
            />

            <DetailRow
              label="Lease Start Date:"
              value={
                tenantInfo.leaseStartDate
              }
            />

            <DetailRow
              label="Lease Duration:"
              value={
                tenantInfo.leaseDuration
              }
            />

            <DetailRow
              label="Contact Phone:"
              value={
                tenantInfo.contact
              }
            />
          </Stack>
        </Paper>

        {/* ==============================================================
            MAINTENANCE
        ============================================================== */}

        <Paper
          elevation={0}
          sx={sectionPaperSx}
        >
          <Box
            sx={sectionHeaderSx}
          >
            <Box>
              <Typography
                variant="h6"
                fontWeight="700"
              >
                Maintenance Requests
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Report an issue in
                your room or unit
              </Typography>
            </Box>

            <Button
              size="small"
              variant="contained"
              startIcon={
                <AddIcon />
              }
              onClick={() =>
                setOpenRepairModal(
                  true
                )
              }
            >
              New Request
            </Button>
          </Box>

          <Stack spacing={1.5}>
            {rankedTickets.length ===
            0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ py: 3 }}
              >
                No active
                maintenance tickets
                reported.
              </Typography>
            ) : (
              rankedTickets.map(
                (t) => (
                  <Box
                    key={t.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor:
                        "background.default",
                      border:
                        "1px solid",
                      borderColor:
                        "divider",
                    }}
                  >
                    <Box
                      sx={
                        ticketHeaderSx
                      }
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight="700"
                      >
                        {t.title}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={0.5}
                      >
                        <Chip
                          label={
                            t.priority
                              .tier
                          }
                          size="small"
                          color={
                            TIER_CHIP_COLOR[
                              t.priority
                                .tier
                            ]
                          }
                        />

                        <Chip
                          label={
                            t.status ||
                            "Pending"
                          }
                          size="small"
                          color={
                            t.status ===
                            "Resolved"
                              ? "success"
                              : "warning"
                          }
                          variant="outlined"
                        />
                      </Stack>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {t.description}
                    </Typography>

                    {t.resolutionNotes && (
                      <Typography
                        variant="caption"
                        color="info.main"
                        sx={{
                          display:
                            "block",
                          mt: 1,
                        }}
                      >
                        <strong>
                          Note:
                        </strong>{" "}
                        {
                          t.resolutionNotes
                        }
                      </Typography>
                    )}
                  </Box>
                )
              )
            )}
          </Stack>
        </Paper>
      </Container>

      {/* ================================================================
          PAY RENT MODAL
      ================================================================= */}

      <Dialog
  open={openPaymentModal}
  onClose={() =>
    !paymentSubmitting &&
    setOpenPaymentModal(
      false
    )
  }
  maxWidth="sm"
  fullWidth
>
        <DialogTitle
          sx={{
            fontWeight: 800,
          }}
        >
          Pay Rent —{" "}
          {currentPeriod}
        </DialogTitle>

        <DialogContent
          dividers
        >
          <Stack
            spacing={2.5}
            sx={{ pt: 1 }}
          >
            {/* PAYMENT MESSAGE */}

            {paymentMessage.text && (
              <Alert
                severity={
                  paymentMessage.type ||
                  "info"
                }
              >
                {
                  paymentMessage.text
                }
              </Alert>
            )}

            {/* AMOUNT DUE */}

            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor:
                  "primary.50",
                border:
                  "1px solid",
                borderColor:
                  "primary.100",
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Current monthly
                rent
              </Typography>

              <Typography
                variant="h5"
                fontWeight="800"
                color="primary.main"
              >
                ₱
                {Number(
                  tenantInfo.monthlyRent ||
                    0
                ).toLocaleString()}
              </Typography>
            </Box>

            {/* PAYMENT METHOD */}

            <FormControl
              fullWidth
            >
              <InputLabel>
                Payment Method
              </InputLabel>

              <Select
                value={
                  selectedPaymentMethod
                }
                label="Payment Method"
                onChange={(e) =>
                  setSelectedPaymentMethod(
                    e.target.value
                  )
                }
              >
                {Object.entries(
                  DRAFT_PAYMENT_METHODS
                )
                  .filter(
                    ([, method]) =>
                      method.enabled
                  )
                  .map(
                    ([method]) => (
                      <MenuItem
                        key={method}
                        value={method}
                      >
                        {method}
                      </MenuItem>
                    )
                  )}
              </Select>
            </FormControl>

            {/* ==========================================================
                GCASH / MAYA QR
            =========================================================== */}

            {(
              selectedPaymentMethod ===
                "GCash" ||
              selectedPaymentMethod ===
                "Maya"
            ) ? (
              <Box
                sx={{
                  textAlign:
                    "center",
                  p: 2,
                  border:
                    "1px solid",
                  borderColor:
                    "divider",
                  borderRadius: 3,
                }}
              >
                <Stack
  direction="row"
  spacing={1}
  sx={{
    alignItems: "center",
    mb: 1,
  }}
>
                  <QrCode2Icon
                    color="primary"
                  />

                  <Typography
                    variant="subtitle1"
                    fontWeight="800"
                  >
                    {
                      selectedPaymentMethod
                    }{" "}
                    QR Code
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    display:
                      "flex",
                    justifyContent:
                      "center",
                    mb: 2,
                  }}
                >
                  <QRCodeCanvas
                    value={
                      selectedMethodDetails.qrValue
                    }
                    size={190}
                    includeMargin
                  />
                </Box>

                <Chip
                  label="DRAFT QR — replace before defense"
                  color="warning"
                  size="small"
                  sx={{
                    mb: 1.5,
                  }}
                />

                <Typography
                  variant="body2"
                  fontWeight="700"
                >
                  {
                    selectedMethodDetails.accountName
                  }
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {
                    selectedMethodDetails.accountNumber
                  }
                </Typography>
              </Box>
            ) : selectedPaymentMethod ===
              "Bank Transfer" ? (
              /* ========================================================
                 BANK TRANSFER
              ========================================================= */

              <Box
                sx={{
                  p: 2,
                  border:
                    "1px solid",
                  borderColor:
                    "divider",
                  borderRadius: 3,
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight="800"
                  sx={{
                    mb: 1,
                  }}
                >
                  Bank Transfer
                  Details
                </Typography>

                <Typography variant="body2">
                  <strong>
                    Bank:
                  </strong>{" "}
                  {
                    selectedMethodDetails.bankName
                  }
                </Typography>

                <Typography variant="body2">
                  <strong>
                    Account Name:
                  </strong>{" "}
                  {
                    selectedMethodDetails.accountName
                  }
                </Typography>

                <Typography variant="body2">
                  <strong>
                    Account Number:
                  </strong>{" "}
                  {
                    selectedMethodDetails.accountNumber
                  }
                </Typography>

                <Chip
                  label="DRAFT DETAILS — replace before defense"
                  color="warning"
                  size="small"
                  sx={{
                    mt: 1.5,
                  }}
                />
              </Box>
            ) : (
              /* ========================================================
                 CASH
              ========================================================= */

              <Alert severity="info">
                {
                  selectedMethodDetails.instructions
                }
              </Alert>
            )}

            {/* PAYMENT AMOUNT */}

            <TextField
              label="Payment Amount"
              type="number"
              fullWidth
              value={
                paymentForm.amount
              }
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  amount:
                    e.target.value,
                })
              }
              InputProps={{
                startAdornment: (
                  <Typography
                    sx={{
                      mr: 1,
                    }}
                  >
                    ₱
                  </Typography>
                ),
              }}
            />

            {/* REFERENCE */}

            <TextField
              label={
                selectedPaymentMethod ===
                "Cash"
                  ? "Reference / Receipt Number (optional)"
                  : "Payment Reference Number"
              }
              fullWidth
              value={
                paymentForm.referenceNumber
              }
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  referenceNumber:
                    e.target.value,
                })
              }
              placeholder={
                selectedPaymentMethod ===
                "Cash"
                  ? "Optional"
                  : "Enter the reference number from your payment"
              }
            />

            {/* DATE */}

            <TextField
              label="Payment Date"
              type="date"
              fullWidth
              value={
                paymentForm.paymentDate
              }
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  paymentDate:
                    e.target.value,
                })
              }
              InputLabelProps={{
                shrink: true,
              }}
            />

            {/* REMARKS */}

            <TextField
              label="Remarks (optional)"
              multiline
              rows={2}
              fullWidth
              value={
                paymentForm.remarks
              }
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  remarks:
                    e.target.value,
                })
              }
              placeholder="Add any additional payment details"
            />

            {/* VERIFICATION NOTICE */}

            <Alert severity="warning">
              Your payment will
              be recorded as{" "}
              <strong>
                Pending
              </strong>
              . The owner must
              verify it before it
              becomes{" "}
              <strong>
                Paid
              </strong>
              .
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{ p: 2 }}
        >
          <Button
            onClick={() =>
              setOpenPaymentModal(
                false
              )
            }
            disabled={
              paymentSubmitting
            }
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              handlePaymentSubmit
            }
            disabled={
              paymentSubmitting
            }
            startIcon={
              paymentSubmitting ? (
                <CircularProgress
                  size={18}
                  color="inherit"
                />
              ) : (
                <PaymentIcon />
              )
            }
          >
            {paymentSubmitting
              ? "Submitting..."
              : "Submit Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ================================================================
          MAINTENANCE MODAL
      ================================================================= */}

      <Dialog
        open={openRepairModal}
        onClose={() =>
          setOpenRepairModal(false)
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
          }}
        >
          Submit Maintenance
          Request
        </DialogTitle>

        <DialogContent
          dividers
        >
          <Stack
            spacing={2}
            sx={{ pt: 1 }}
          >
            <FormControl
              fullWidth
            >
              <InputLabel>
                Category
              </InputLabel>

              <Select
                value={
                  repairForm.category
                }
                label="Category"
                onChange={(e) =>
                  setRepairForm({
                    ...repairForm,
                    category:
                      e.target.value,
                  })
                }
              >
                {CATEGORY_OPTIONS.map(
                  (opt) => (
                    <MenuItem
                      key={
                        opt.value
                      }
                      value={
                        opt.value
                      }
                    >
                      {opt.label}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>

            <TextField
              label="Issue Summary"
              placeholder="e.g. Water leak, Light bulb replacement"
              fullWidth
              value={
                repairForm.title
              }
              onChange={(e) =>
                setRepairForm({
                  ...repairForm,
                  title:
                    e.target.value,
                })
              }
            />

            <TextField
              label="Detailed Description"
              multiline
              rows={3}
              fullWidth
              value={
                repairForm.description
              }
              onChange={(e) =>
                setRepairForm({
                  ...repairForm,
                  description:
                    e.target.value,
                })
              }
            />
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{ p: 2 }}
        >
          <Button
            onClick={() =>
              setOpenRepairModal(
                false
              )
            }
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              handleRequestSubmit
            }
          >
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const metricCardSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
};

const metricHeaderSx = {
  display: "flex",
  justifyContent: "space-between",
  mb: 1,
};

const sectionPaperSx = {
  p: 3,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
};

const sectionHeaderSx = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  mb: 1,
};

const ticketHeaderSx = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  mb: 0.5,
  gap: 1,
};

// ============================================================================
// PAYMENT INFO BOX
// ============================================================================

function PaymentInfoBox({
  label,
  value,
  icon,
  chip = false,
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor:
          "background.default",
        border: "1px solid",
        borderColor:
          "divider",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          mb: 0.75,
        }}
      >
        {icon}

        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight="600"
        >
          {label}
        </Typography>
      </Stack>

      {chip ? (
        <Chip
          label={value}
          size="small"
          color={getPaymentChipColor(
            value
          )}
          sx={{
            fontWeight: 700,
          }}
        />
      ) : (
        <Typography
          variant="subtitle1"
          fontWeight="800"
        >
          {value}
        </Typography>
      )}
    </Box>
  );
}

// ============================================================================
// DETAIL ROW
// ============================================================================

function DetailRow({
  label,
  value,
  valueColor,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent:
          "space-between",
        gap: 2,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
      >
        {label}
      </Typography>

      <Typography
        variant="subtitle2"
        fontWeight="700"
        color={valueColor}
        sx={{
          textAlign: "right",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

// ============================================================================
// PAYMENT STATUS COLOR
// ============================================================================

function getPaymentChipColor(
  status
) {
  switch (
    String(
      status || ""
    ).toLowerCase()
  ) {
    case "paid":
      return "success";

    case "pending":
    case "pending verification":
    case "partial":
      return "warning";

    case "overdue":
    case "rejected":
      return "error";

    default:
      return "default";
  }
}

// ============================================================================
// TODAY
// ============================================================================

function getTodayInputValue() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ============================================================================
// FIREBASE TIMESTAMP SORTING
// ============================================================================

function getTimestampMillis(
  value
) {
  if (!value) {
    return 0;
  }

  if (
    typeof value?.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  const time =
    new Date(value).getTime();

  return Number.isNaN(time)
    ? 0
    : time;
}

// ============================================================================
// LEASE DURATION
// ============================================================================

function formatLeaseDuration(
  val
) {
  if (!val) {
    return "Not specified";
  }

  switch (val) {
    case "3_months":
      return "3 Months";

    case "6_months":
      return "6 Months";

    case "12_months":
      return "12 Months";

    case "custom":
      return "Custom Term";

    default:
      return val;
  }

}