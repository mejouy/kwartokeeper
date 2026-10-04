import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Divider,
  Switch,
  FormControlLabel,
  Alert
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import MapsHomeWorkIcon from "@mui/icons-material/MapsHomeWork";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import GroupIcon from "@mui/icons-material/Group";
import BadgeIcon from '@mui/icons-material/Badge';
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DescriptionIcon from "@mui/icons-material/Description";
import { 
  doc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc,
  addDoc 
} from "firebase/firestore";
import { db } from "../../config/firebase";

export default function OwnerDetails() {
  const { ownerId, id } = useParams();
  const targetId = ownerId || id; 
  
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(null);
  const [properties, setProperties] = useState([]);
  const [tenantCount, setTenantCount] = useState(0);
  const [caretakerCount, setCaretakerCount] = useState(0);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!targetId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Fetch Owner Profile
    const unsubOwner = onSnapshot(
      doc(db, "users", targetId),
      (docSnap) => {
        if (docSnap.exists()) {
          setOwner({ id: docSnap.id, ...docSnap.data() });
        } else {
          setOwner(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching owner:", error);
        setLoading(false);
      }
    );

    // 2. Fetch Properties matching ownerUid
    const qProps = query(collection(db, "properties"), where("ownerUid", "==", targetId));
    const unsubProps = onSnapshot(qProps, (snapshot) => {
      const propList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setProperties(propList);
    });

    // 3. Fetch Tenants matching ownerUid
    const qTenants = query(collection(db, "tenants"), where("ownerUid", "==", targetId));
    const unsubTenants = onSnapshot(qTenants, (snapshot) => {
      setTenantCount(snapshot.docs.length);
    });

    // 4. Fetch Caretakers matching ownerUid
    const qCaretakers = query(collection(db, "caretakers"), where("ownerUid", "==", targetId));
    const unsubCaretakers = onSnapshot(qCaretakers, (snapshot) => {
      setCaretakerCount(snapshot.docs.length);
    });

    return () => {
      unsubOwner();
      unsubProps();
      unsubTenants();
      unsubCaretakers();
    };
  }, [targetId]);

  // Handle standard suspension toggle
  const handleToggleStatus = async () => {
    if (!owner) return;
    setUpdatingStatus(true);
    setActionError("");

    const currentStatus = owner.status || "active";
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";

    try {
      await updateDoc(doc(db, "users", targetId), {
        status: newStatus,
        // If an admin manually activates a previously rejected account, update the approval status too
        ...(newStatus === "active" && owner.approvalStatus === "rejected" ? { approvalStatus: "approved" } : {}),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update status:", err);
      setActionError("Failed to update account status. Please check permissions.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Admin Approval of Pending Accounts AND Create In-App Notification
  const handleApproval = async (newApprovalStatus) => {
    if (!owner) return;
    setUpdatingStatus(true);
    setActionError("");

    try {
      const timestamp = new Date().toISOString();

      // 1. Update the owner's account status
      await updateDoc(doc(db, "users", targetId), {
        approvalStatus: newApprovalStatus,
        status: newApprovalStatus === "approved" ? "active" : "suspended", 
        updatedAt: timestamp
      });

      // 2. Generate the appropriate notification payload
      let notificationTitle = "";
      let notificationMessage = "";
      let notificationType = "info";

      if (newApprovalStatus === "approved") {
        notificationTitle = "Account Approved!";
        notificationMessage = "Congratulations! Your property owner account has been verified. You now have full access to your operational dashboard.";
        notificationType = "success";
      } else if (newApprovalStatus === "rejected") {
        notificationTitle = "Application Rejected";
        notificationMessage = "Unfortunately, your account verification was declined. Please contact support or resubmit valid documentation.";
        notificationType = "error";
      }

      // 3. Create the in-app notification document
      await addDoc(collection(db, "notifications"), {
        userId: targetId,
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        isRead: false,
        createdAt: timestamp
      });

    } catch (err) {
      console.error("Failed to update approval status:", err);
      setActionError("Failed to process approval and send notification. Please check permissions.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formatAddress = (addressData) => {
    if (!addressData) return "No address provided";
    if (typeof addressData === "string") return addressData; 
    
    const parts = [
      addressData.street,
      addressData.barangay,
      addressData.cityMunicipality,
      addressData.province
    ].filter(Boolean); 
    
    return parts.join(", ");
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!owner) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/admin/owners")} sx={{ mb: 2 }}>
          Back to Owners Directory
        </Button>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Owner account not found or has been removed.
        </Alert>
      </Container>
    );
  }

  // Adjusted to ensure firstName/lastName are captured properly
  const ownerName = owner.fullName || owner.name || 
    (owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : "Unnamed Owner");
  
  // Adjusted to properly sync with the ManageOwners directory status mappings
  const isPending = owner.status === "pending" || owner.approvalStatus === "pending";
  const isRejected = owner.approvalStatus === "rejected";
  const isSuspended = owner.status === "suspended" && !isRejected;
  
  const totalRooms = properties.reduce((acc, curr) => acc + (Number(curr.totalRooms) || 0), 0);

  // Dynamic profile status logic
  let avatarColor = "primary.main";
  let chipLabel = "Active Account";
  let chipColor = "success";
  let chipVariant = "outlined";

  if (isPending) {
    avatarColor = "warning.main";
    chipLabel = "Pending Approval";
    chipColor = "warning";
    chipVariant = "filled";
  } else if (isRejected) {
    avatarColor = "error.main";
    chipLabel = "Application Rejected";
    chipColor = "error";
    chipVariant = "filled";
  } else if (isSuspended) {
    avatarColor = "error.main";
    chipLabel = "Suspended";
    chipColor = "error";
    chipVariant = "filled";
  }

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate("/admin/owners")}
          variant="outlined"
          size="small"
          sx={{ borderRadius: 2 }}
        >
          Back to Directory
        </Button>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setActionError("")}>
          {actionError}
        </Alert>
      )}

      {isPending && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>Action Required:</strong> This owner has submitted verification documents and is awaiting your approval to unlock dashboard features.
        </Alert>
      )}

      {isRejected && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>Application Rejected:</strong> This owner's verification was declined. You can manually activate their account below if needed.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Column: Owner Profile Summary */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", mb: 3 }}>
              <Avatar 
                sx={{ 
                  width: 80, 
                  height: 80, 
                  fontSize: "2rem", 
                  bgcolor: avatarColor,
                  fontWeight: 800,
                  mb: 2 
                }}
              >
                {ownerName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h6" fontWeight="700">
                {ownerName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Platform Property Owner
              </Typography>
              <Chip 
                label={chipLabel} 
                color={chipColor}
                variant={chipVariant}
                size="small" 
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Divider sx={{ my: 2.5 }} />

            {/* Contact Details */}
            <Stack spacing={2} sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <EmailIcon fontSize="small" color="action" />
                <Typography variant="body2">{owner.email || "No Email Provided"}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <PhoneIcon fontSize="small" color="action" />
                <Typography variant="body2">{owner.phoneNumber || owner.phone || owner.mobile || "No Phone Provided"}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <CalendarTodayIcon fontSize="small" color="action" />
                <Typography variant="body2">Registered: {formatDate(owner.createdAt)}</Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            {/* Verification Documents Review */}
            <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1.5 }}>
              Verification Documents
            </Typography>
            {owner.verificationDocs ? (
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<DescriptionIcon />} 
                  href={owner.verificationDocs.idUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                  disabled={!owner.verificationDocs.idUrl}
                >
                  View Government ID
                </Button>
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<DescriptionIcon />} 
                  href={owner.verificationDocs.clearanceUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                  disabled={!owner.verificationDocs.clearanceUrl}
                >
                  View Proof of Ownership
                </Button>
                {owner.verificationDocs.submittedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Submitted: {formatDate(owner.verificationDocs.submittedAt)}
                  </Typography>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                No verification documents submitted yet.
              </Typography>
            )}

            <Divider sx={{ my: 2.5 }} />

            {/* Admin Management Controls */}
            <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1.5 }}>
              Account Management
            </Typography>
            
            {isPending ? (
              <Stack spacing={1.5}>
                <Button 
                  variant="contained" 
                  color="success" 
                  startIcon={<CheckCircleIcon />}
                  onClick={() => handleApproval("approved")}
                  disabled={updatingStatus}
                  fullWidth
                >
                  Approve Account
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  startIcon={<CancelIcon />}
                  onClick={() => handleApproval("rejected")}
                  disabled={updatingStatus}
                  fullWidth
                >
                  Reject Application
                </Button>
              </Stack>
            ) : (
              <Paper elevation={0} sx={{ p: 2, bgcolor: "background.default", borderRadius: 2 }}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={!isSuspended} 
                      onChange={handleToggleStatus}
                      disabled={updatingStatus}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight="600">
                      {isSuspended ? "Activate Account" : "Account Enabled"}
                    </Typography>
                  }
                />
              </Paper>
            )}
          </Paper>
        </Grid>

        {/* Right Column: Owner Portfolio & Metrics */}
        <Grid item xs={12} md={8}>
          {/* Quick Metrics */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="700">PROPERTIES</Typography>
                    <MapsHomeWorkIcon color="primary" fontSize="small" />
                  </Box>
                  <Typography variant="h5" fontWeight="800">{properties.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="700">TOTAL ROOMS</Typography>
                    <MeetingRoomIcon color="info" fontSize="small" />
                  </Box>
                  <Typography variant="h5" fontWeight="800">{totalRooms}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="700">TENANTS</Typography>
                    <GroupIcon color="success" fontSize="small" />
                  </Box>
                  <Typography variant="h5" fontWeight="800">{tenantCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="700">CARETAKERS</Typography>
                    <BadgeIcon color="warning" fontSize="small" />
                  </Box>
                  <Typography variant="h5" fontWeight="800">{caretakerCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Properties Portfolio Directory */}
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight="700">
                Registered Properties ({properties.length})
              </Typography>
            </Box>

            <Stack spacing={2}>
              {properties.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    This owner has not registered any properties yet.
                  </Typography>
                </Box>
              ) : (
                properties.map((prop) => {
                  return (
                    <Box 
                      key={prop.id} 
                      sx={{ 
                        p: 2.5, 
                        borderRadius: 2, 
                        border: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 2,
                        bgcolor: "background.paper"
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight="700">
                          {prop.propertyName || "Unnamed Property"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatAddress(prop.address)}
                        </Typography>
                        
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            <strong>Type:</strong> {prop.propertyType || "N/A"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <strong>Rooms:</strong> {prop.totalRooms || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <strong>Beds:</strong> {prop.totalBeds || 0}
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}