import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  CircularProgress,
  Avatar,
} from "@mui/material";

import PersonAddIcon from "@mui/icons-material/PersonAdd";

import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "../../../config/firebase";

export default function TenantList() {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // =========================================================
  // LOAD TENANTS
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "tenants"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tenantData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setTenants(tenantData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tenants:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // LOAD PAYMENTS
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "payments"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setPayments(paymentData);
      },
      (error) => {
        console.error("Error fetching payments:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // GET PAYMENT DATE
  // =========================================================
  const getPaymentDate = (payment) => {
    const dateValue =
      payment?.paymentDate || payment?.createdAt;

    if (!dateValue) {
      return null;
    }

    // Firestore Timestamp
    if (typeof dateValue.toDate === "function") {
      return dateValue.toDate();
    }

    // JavaScript Date
    if (dateValue instanceof Date) {
      return dateValue;
    }

    // String / number
    const parsedDate = new Date(dateValue);

    if (isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  };

  // =========================================================
  // FORMAT PAYMENT DATE
  // =========================================================
  const formatPaymentDate = (payment) => {
    const date = getPaymentDate(payment);

    if (!date) {
      return "No payment";
    }

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // =========================================================
  // FORMAT AMOUNT
  // =========================================================
  const formatAmount = (amount) => {
    const numericAmount = Number(amount || 0);

    return numericAmount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  // =========================================================
  // GET TENANT PAYMENTS
  // =========================================================
  const getTenantPayments = (tenantId) => {
    return payments
      .filter((payment) => payment.tenantId === tenantId)
      .sort((a, b) => {
        const dateA = getPaymentDate(a);
        const dateB = getPaymentDate(b);

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateB.getTime() - dateA.getTime();
      });
  };

  // =========================================================
  // GET LAST PAYMENT
  // =========================================================
  const getLastPayment = (tenantId) => {
    const tenantPayments = getTenantPayments(tenantId);

    if (tenantPayments.length === 0) {
      return null;
    }

    return tenantPayments[0];
  };

  // =========================================================
  // SEARCH TENANTS
  // =========================================================
  const filteredTenants = tenants.filter((t) => {
    const name = t.fullName || t.name || "";
    const email = t.email || "";

    const term = searchQuery.toLowerCase();

    return (
      name.toLowerCase().includes(term) ||
      email.toLowerCase().includes(term)
    );
  });

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
      }}
    >
      {/* =====================================================
          HEADER
      ===================================================== */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h6" fontWeight="700">
          Enrolled Tenants Directory
        </Typography>

        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder="Search tenant or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => navigate("/owner/tenants/register")}
          >
            Register Tenant
          </Button>
        </Stack>
      </Box>

      {/* =====================================================
          TENANT TABLE
      ===================================================== */}
      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell>
                <strong>Tenant Name</strong>
              </TableCell>

              <TableCell>
                <strong>Room</strong>
              </TableCell>

              <TableCell>
                <strong>Last Payment</strong>
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

              <TableCell align="right">
                <strong>Action</strong>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {/* =================================================
                LOADING
            ================================================= */}
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ py: 5 }}
                >
                  <CircularProgress size={32} />

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Loading directory...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredTenants.length === 0 ? (
              /* ===============================================
                  NO TENANTS
              =============================================== */
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ py: 4 }}
                >
                  <Typography color="text.secondary">
                    {searchQuery
                      ? "No tenants match your search."
                      : "No tenants enrolled yet."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              /* ===============================================
                  TENANTS
              =============================================== */
              filteredTenants.map((t) => {
                const lastPayment = getLastPayment(t.id);

                return (
                  <TableRow key={t.id} hover>

                    {/* =========================================
                        TENANT NAME
                    ========================================= */}
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                        }}
                      >
                        <Avatar
                          src={t.idPhotoUrl || ""}
                          alt={t.fullName || t.name}
                          sx={{
                            width: 36,
                            height: 36,
                            fontSize: "0.875rem",
                          }}
                        >
                          {(t.fullName || t.name || "T")
                            .charAt(0)
                            .toUpperCase()}
                        </Avatar>

                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight="700"
                          >
                            {t.fullName ||
                              t.name ||
                              "Unnamed Tenant"}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {t.idType
                              ? t.idType
                                  .replace("_", " ")
                                  .toUpperCase()
                              : "No ID Provided"}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* =========================================
                        ROOM
                    ========================================= */}
                    <TableCell>
                      {t.roomId ? (
                        <Typography
                          variant="body2"
                          fontWeight="500"
                        >
                          {t.roomId}
                          {t.bedId ? ` (${t.bedId})` : ""}
                        </Typography>
                      ) : (
                        <Chip
                          label="Unassigned"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </TableCell>

                    {/* =========================================
                        LAST PAYMENT
                    ========================================= */}
                    <TableCell>
                      {lastPayment ? (
                        <Typography
                          variant="body2"
                          fontWeight="500"
                        >
                          {formatPaymentDate(lastPayment)}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          No payment
                        </Typography>
                      )}
                    </TableCell>

                    {/* =========================================
                        AMOUNT
                    ========================================= */}
                    <TableCell>
                      {lastPayment ? (
                        <Typography
                          variant="body2"
                          fontWeight="700"
                        >
                          {formatAmount(lastPayment.amount)}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* =========================================
                        PAYMENT METHOD
                    ========================================= */}
                    <TableCell>
                      {lastPayment ? (
                        <Typography variant="body2">
                          {lastPayment.paymentMethod ||
                            "Not specified"}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* =========================================
                        TENANT STATUS
                    ========================================= */}
                    <TableCell>
                      <Chip
                        label={t.status || "Active"}
                        color={
                          t.status === "Pending Onboarding"
                            ? "warning"
                            : t.status === "Inactive"
                            ? "default"
                            : "success"
                        }
                        size="small"
                      />
                    </TableCell>

                    {/* =========================================
                        ACTION
                    ========================================= */}
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() =>
                          navigate(`/owner/tenants/${t.id}`)
                        }
                      >
                        Manage
                      </Button>
                    </TableCell>

                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}