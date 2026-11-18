// Shown to a caretaker whose owner set them to inactive (Caretakers → profile).
// Nothing is deleted; the owner can set them active again.
import { Box, Button, Paper, Typography } from "@mui/material";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import BrandLogo from "./BrandLogo";
import { t } from "../i18n";

export default function AccountInactive() {
  const navigate = useNavigate();
  const leave = async () => {
    try {
      await signOut(auth);
    } finally {
      navigate("/login", { replace: true });
    }
  };
  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "background.default" }}>
      <Box sx={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
        <BrandLogo appearance="light" sx={{ height: 38, width: "auto", mb: 3 }} />
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: "20px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Box sx={{ width: 60, height: 60, borderRadius: "50%", mx: "auto", mb: 2, display: "grid", placeItems: "center", bgcolor: "rgba(32,32,32,.07)" }}>
            <PauseCircleOutlineRoundedIcon sx={{ fontSize: 32, color: "text.secondary" }} />
          </Box>
          <Typography component="h1" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "1.35rem", mb: 1 }}>
            {t("Your caretaker account is inactive")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("The property owner has paused your access. Your records are kept. Contact the owner if you think this is a mistake.")}
          </Typography>
          <Button variant="contained" disableElevation fullWidth onClick={leave} sx={{ fontWeight: 700, borderRadius: "12px", minHeight: 46 }}>
            {t("Sign out")}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
