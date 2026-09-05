// src/pages/WizardSuccess.jsx
//
// Screen 4: Setup Complete. Reads the summary passed via navigate() state
// from Step3Rooms.jsx. If the owner refreshes this page directly, `state`
// will be empty — the fallback below handles that instead of crashing.

import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Stack,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function WizardSuccess() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const summary = state?.summary || { totalRooms: 0, totalBeds: 0 };

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", p: 3, textAlign: "center" }}>
      <CheckCircleIcon sx={{ fontSize: 72, color: "success.main", mb: 2 }} />

      <Typography variant="h1" sx={{ mb: 1 }}>
        Your Property is Ready!
      </Typography>

      {/* NOTE: Spec listed "Current Occupancy: 0% (0/40)" as a single metric
          inside a 2x2 grid. Split it into 2 cards (Current Occupancy % and
          Occupied Beds count) so the grid has 4 filled cells instead of 3
          with one blank slot. Merge back into one card if the team prefers
          matching the spec exactly. */}
      <Grid container spacing={2} sx={{ my: 3 }}>
        <Grid item xs={6}>
          <MetricCard label="Total Rooms" value={summary.totalRooms} />
        </Grid>
        <Grid item xs={6}>
          <MetricCard label="Total Beds" value={summary.totalBeds} />
        </Grid>
        <Grid item xs={6}>
          <MetricCard label="Current Occupancy" value="0%" />
        </Grid>
        <Grid item xs={6}>
          <MetricCard label="Occupied Beds" value={`0/${summary.totalBeds}`} />
        </Grid>
      </Grid>

      <Button
        variant="contained"
        fullWidth
        sx={{ mb: 2 }}
        onClick={() => navigate("/owner/dashboard")}
      >
        Go to Owner Dashboard
      </Button>

      <Stack spacing={1}>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => navigate("/owner/tenants/add")}
        >
          + Add First Tenant Now
        </Button>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => navigate("/owner/caretakers/invite")}
        >
          + Invite Caretaker
        </Button>
      </Stack>
    </Box>
  );
}

function MetricCard({ label, value }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h2">{value}</Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
