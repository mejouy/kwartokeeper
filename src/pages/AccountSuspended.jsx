import React from "react";
import { Box, Typography, Button, Paper, Container } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase"; // Adjust path to your firebase config
import { useNavigate } from "react-router-dom";

export default function AccountSuspended() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 10, display: "flex", justifyContent: "center" }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 5, 
            textAlign: "center", 
            borderRadius: 4,
            borderTop: "6px solid",
            borderColor: "error.main"
          }}
        >
          <BlockIcon sx={{ fontSize: 60, color: "error.main", mb: 2 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Account Suspended
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Your account has been suspended by an administrator. You currently do not have access to the platform's features. Please contact support for more information.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleLogout}
            fullWidth
          >
            Sign Out
          </Button>
        </Paper>
      </Box>
    </Container>
  );
}