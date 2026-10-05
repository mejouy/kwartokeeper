// src/pages/owner/tenants/TenantList.jsx

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
  Divider,
} from "@mui/material";

import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ApartmentIcon from "@mui/icons-material/Apartment";

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
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // =========================================================
  // FORMAT ADDRESS HELPER (Fixes object rendering crash)
  // =========================================================
  const formatAddress = (addr) => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;

    // Joins the address object fields into a single clean string
    return [
      addr.street,
      addr.barangay,
      addr.cityMunicipality,
      addr.province,
      addr.region,
    ]
      .filter(Boolean)
      .join(", ");
  };

  // =========================================================
  // LOAD PROPERTIES
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "properties"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const propData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProperties(propData);
      },
      (error) => {
        console.error("Error fetching properties:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // LOAD TENANTS
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const ownerId = auth.currentUser.uid;
    const tenantSources = new Map();
    let active = true;

    const publishTenants = () => {
      const tenantsById = new Map();
      tenantSources.forEach((sourceTenants) => {
        sourceTenants.forEach((tenant) => {
          const tenantId = tenant.uid || tenant.id;
          tenantsById.set(tenantId, {
            ...(tenantsById.get(tenantId) || {}),
            ...tenant,
          });
        });
      });
      if (active) {
        setTenants([...tenantsById.values()]);
        setLoading(false);
      }
    };

    const subscribeToTenantSource = (sourceId, collectionName, field, value, usersOnly = false) =>
      onSnapshot(
        query(collection(db, collectionName), where(field, "==", value)),
        (snapshot) => {
          const records = snapshot.docs
            .map((tenantDoc) => ({ id: tenantDoc.id, ...tenantDoc.data() }))
            .filter((tenant) => !usersOnly || tenant.role === "tenant");
          tenantSources.set(sourceId, records);
          publishTenants();
        },
        (error) => {
          console.error(`Error fetching tenant records from ${collectionName}:`, error);
          if (active) setLoading(false);
        }
      );

    const unsubscribers = [
      subscribeToTenantSource("owner:tenants", "tenants", "ownerUid", ownerId),
      subscribeToTenantSource("owner:users", "users", "ownerUid", ownerId, true),
    ];
    properties.forEach((property) => {
      unsubscribers.push(
        subscribeToTenantSource(`property:${property.id}:tenants`, "tenants", "propertyId", property.id),
        subscribeToTenantSource(`property:${property.id}:users`, "users", "propertyId", property.id, true)
      );
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [properties]);

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
    const dateValue = payment?.paymentDate || payment?.createdAt;
    if (!dateValue) return null;

    if (typeof dateValue.toDate === "function") {
      return dateValue.toDate();
    }
    if (dateValue instanceof Date) {
      return dateValue;
    }

    const parsedDate = new Date(dateValue);
    if (isNaN(parsedDate.getTime())) return null;

    return parsedDate;
  };

  // =========================================================
  // FORMAT PAYMENT DATE
  // =========================================================
  const formatPaymentDate = (payment) => {
    const date = getPaymentDate(payment);
    if (!date) return "No payment";

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
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
    if (tenantPayments.length === 0) return null;
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

  // =========================================================
  // GROUP TENANTS BY PROPERTY
  // =========================================================
  const groupedByProperty = properties.reduce((acc, property) => {
    acc[property.id] = {
      propertyName: property.name || property.propertyName || "Unnamed Property",
      propertyAddress: property.address || "",
      tenants: filteredTenants.filter(
        (t) => t.propertyId === property.id || t.propertyId === property.name
      ),
    };
    return acc;
  }, {});

  // Catch tenants that aren't tied to any loaded property ID/name
  const assignedPropertyIds = new Set(properties.map((p) => p.id));
  const assignedPropertyNames = new Set(properties.map((p) => p.name));
  
  const unassignedTenants = filteredTenants.filter(
    (t) =>
      !t.propertyId ||
      (!assignedPropertyIds.has(t.propertyId) && !assignedPropertyNames.has(t.propertyId))
  );

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
          LOADING / CONTENT
      ===================================================== */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : filteredTenants.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            {searchQuery
              ? "No tenants match your search."
              : "No tenants enrolled yet."}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={4}>
          {/* Loop Through Properties */}
          {Object.entries(groupedByProperty).map(([propId, group]) => {
            if (group.tenants.length === 0 && searchQuery) return null; // Hide empty property groups during search if no match

            const formattedAddress = formatAddress(group.propertyAddress);

            return (
              <Box key={propId}>
                {/* Property Sub-header */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                  <ApartmentIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle1" fontWeight="700">
                      {group.propertyName}
                    </Typography>
                    {formattedAddress && (
                      <Typography variant="caption" color="text.secondary">
                        {formattedAddress}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table>
                    <TableHead sx={{ bgcolor: "background.default" }}>
                      <TableRow>
                        <TableCell><strong>Tenant Name</strong></TableCell>
                        <TableCell><strong>Room</strong></TableCell>
                        <TableCell><strong>Last Payment</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell align="right"><strong>Action</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.tenants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                              No tenants assigned to this property yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        group.tenants.map((t) => {
                          const lastPayment = getLastPayment(t.id);

                          return (
                            <TableRow key={t.id} hover>
                              <TableCell>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                  <Avatar
                                    src={t.idPhotoUrl || ""}
                                    alt={t.fullName || t.name}
                                    sx={{ width: 36, height: 36, fontSize: "0.875rem" }}
                                  >
                                    {(t.fullName || t.name || "T").charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Box>
                                    <Typography variant="subtitle2" fontWeight="700">
                                      {t.fullName || t.name || "Unnamed Tenant"}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {t.email || (t.idType ? t.idType.replace("_", " ").toUpperCase() : "No ID Provided")}
                                    </Typography>
                                  </Box>
                                </Box>
                              </TableCell>

                              <TableCell>
                                {t.roomId ? (
                                  <Typography variant="body2" fontWeight="500">
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

                              <TableCell>
                                <Typography variant="body2" fontWeight={lastPayment ? "500" : "regular"} color={lastPayment ? "text.primary" : "text.secondary"}>
                                  {formatPaymentDate(lastPayment)}
                                </Typography>
                              </TableCell>

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

                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => navigate(`/owner/tenants/${t.id}`)}
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
              </Box>
            );
          })}

          {/* Unassigned Tenants Section (if any) */}
          {unassignedTenants.length > 0 && (!searchQuery || unassignedTenants.length > 0) && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                <ApartmentIcon color="action" />
                <Typography variant="subtitle1" fontWeight="700" color="text.secondary">
                  Unassigned / Other Tenants
                </Typography>
              </Stack>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead sx={{ bgcolor: "background.default" }}>
                    <TableRow>
                      <TableCell><strong>Tenant Name</strong></TableCell>
                      <TableCell><strong>Room</strong></TableCell>
                      <TableCell><strong>Last Payment</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell align="right"><strong>Action</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unassignedTenants.map((t) => {
                      const lastPayment = getLastPayment(t.id);

                      return (
                        <TableRow key={t.id} hover>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Avatar
                                src={t.idPhotoUrl || ""}
                                alt={t.fullName || t.name}
                                sx={{ width: 36, height: 36, fontSize: "0.875rem" }}
                              >
                                {(t.fullName || t.name || "T").charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight="700">
                                  {t.fullName || t.name || "Unnamed Tenant"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t.email || "No email provided"}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Chip label="Unassigned" size="small" color="warning" variant="outlined" />
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" color={lastPayment ? "text.primary" : "text.secondary"}>
                              {formatPaymentDate(lastPayment)}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            <Chip label={t.status || "Active"} color="success" size="small" />
                          </TableCell>

                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => navigate(`/owner/tenants/${t.id}`)}
                            >
                              Manage
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}