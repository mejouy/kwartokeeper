// src/pages/WizardSuccess.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Button, Alert } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// The same facade motif from the login page (window size, gap, and lit
// pattern), tiled and blurred to sit behind the card as ambient texture —
// not a literal illustration here, just depth.
const TILE_COLS = 5;
const TILE_ROWS = 6;
const TILE_SIZE = 34;
const TILE_GAP = 18;
const TILE_LIT_PATTERN = [
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  1, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 1,
  1, 0, 0, 1, 0,
];

function buildFacadeTileBackground() {
  const step = TILE_SIZE + TILE_GAP;
  const width = TILE_COLS * step - TILE_GAP;
  const height = TILE_ROWS * step - TILE_GAP;
  const rects = TILE_LIT_PATTERN.map((lit, i) => {
    const x = (i % TILE_COLS) * step;
    const y = Math.floor(i / TILE_COLS) * step;
    const fill = lit ? "rgba(255,69,0,0.16)" : "rgba(202,220,246,0.06)";
    return `<rect x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" rx="4" fill="${fill}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const FACADE_TILE_BG = buildFacadeTileBackground();

function Stat({ value, label }) {
  return (
    <Box sx={{ bgcolor: "rgba(0, 0, 0, 0.035)", borderRadius: 2, py: 1.5, textAlign: "center" }}>
      <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.2rem", color: "text.primary" }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function NextUpRow({ icon: Icon, label, onClick, last }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.5,
        px: 1,
        border: "none",
        borderBottom: last ? "none" : "1px solid rgba(0, 0, 0, 0.08)",
        borderRadius: 1.5,
        bgcolor: "transparent",
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
        "&:hover": { bgcolor: "rgba(255, 69, 0, 0.06)" },
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: "8px",
          bgcolor: "rgba(255, 69, 0, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 17, color: "primary.main" }} />
      </Box>
      <Typography variant="body2" sx={{ flex: 1, color: "text.primary", fontWeight: 500 }}>
        {label}
      </Typography>
      <ChevronRightIcon sx={{ fontSize: 18, color: "text.secondary" }} />
    </Box>
  );
}

export default function WizardSuccess() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Flexible parsing supporting both direct state object or wrapped .summary state
  const propertyId = state?.propertyId || state?.summary?.propertyId;
  const propertyName = state?.propertyName?.trim() || state?.summary?.propertyName?.trim();
  const totalRooms = state?.totalRooms ?? state?.summary?.totalRooms ?? 0;
  const totalBeds = state?.totalBeds ?? state?.summary?.totalBeds ?? 0;
  const coverPhotoUrl = state?.coverPhotoUrl || state?.summary?.coverPhotoUrl;
  const warningMessage = state?.warning;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#121212",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        px: 2,
        py: { xs: 5, md: 8 },
      }}
    >
      {/* Blurred facade texture */}
      <Box
        sx={{
          position: "absolute",
          inset: -20,
          backgroundImage: FACADE_TILE_BG,
          backgroundRepeat: "repeat",
          filter: "blur(3px)",
          opacity: 0.9,
          pointerEvents: "none",
        }}
      />

      {/* Ambient glow behind the card */}
      <Box
        sx={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 69, 0, 0.18), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* The hero card */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          bgcolor: "#f2e9dd",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
        }}
      >
        {warningMessage && (
          <Alert severity="warning" sx={{ borderRadius: 0 }}>
            {warningMessage}
          </Alert>
        )}

        {/* Banner */}
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              height: 150,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...(coverPhotoUrl
                ? {
                    backgroundImage: `url(${coverPhotoUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : { bgcolor: "#202020" }),
            }}
          >
            {coverPhotoUrl && (
              <Box sx={{ position: "absolute", inset: 0, top: 0, height: 150, bgcolor: "rgba(0, 0, 0, 0.35)" }} />
            )}
            {!coverPhotoUrl && <HomeWorkOutlinedIcon sx={{ fontSize: 40, color: "#cadcf6" }} />}
          </Box>
          <Box
            sx={{
              position: "absolute",
              bottom: -16,
              right: 24,
              width: 34,
              height: 34,
              borderRadius: "50%",
              bgcolor: "primary.main",
              border: "3px solid #f2e9dd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckIcon sx={{ fontSize: 17, color: "#ffffff" }} />
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: { xs: 3, sm: 4 }, pt: 3.5, pb: 4, textAlign: "center" }}>
          <Typography
            variant="h5"
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: "text.primary" }}
          >
            {propertyName ? `${propertyName} is ready` : "Your property is ready"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Your rooms and beds have been set up. Here's what you built.
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, mb: 3 }}>
            <Stat value={totalRooms} label="Rooms" />
            <Stat value={totalBeds} label="Beds" />
            <Stat value="0%" label="Occupied" />
            <Stat value={0} label="Tenants" />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, display: "block", textAlign: "left", mb: 0.5, px: 1 }}
          >
            Next up
          </Typography>
          <Box sx={{ mb: 3 }}>
            <NextUpRow
              icon={PersonAddAltOutlinedIcon}
              label="Add your first tenant"
              onClick={() => navigate(propertyId ? `/owner/tenants/register?propertyId=${propertyId}` : "/owner/tenants/add")}
            />
            <NextUpRow
              icon={SupervisorAccountOutlinedIcon}
              label="Invite a caretaker"
              onClick={() => navigate("/owner/caretakers/invite")}
              last
            />
          </Box>

          <Button
            variant="contained"
            fullWidth
            sx={{ py: 1.5, fontWeight: 600 }}
            onClick={() => navigate("/owner/dashboard")}
          >
            Go to owner dashboard
          </Button>
        </Box>
      </Box>
    </Box>
  );
}