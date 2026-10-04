import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Container, Typography, Paper } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import HomeIcon from "@mui/icons-material/Home";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ display: "flex", alignItems: "center", minHeight: "100vh" }}>
      <Paper
        elevation={0}
        sx={{
          p: 5,
          textAlign: "center",
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          width: "100%",
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
        <Typography variant="h3" fontWeight="800" gutterBottom>
          404
        </Typography>
        <Typography variant="h6" fontWeight="700" gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          The page you are looking for doesn't exist, has been removed, or you don't have permission to access it.
        </Typography>
        <Button
          variant="contained"
          startIcon={<HomeIcon />}
          onClick={() => navigate("/")}
          sx={{ py: 1.2, px: 3, borderRadius: 2 }}
        >
          Back to Home
        </Button>
      </Paper>
    </Container>
  );
}