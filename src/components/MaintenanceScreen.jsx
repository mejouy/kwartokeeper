// Shown to owners, caretakers and tenants while an admin has maintenance mode
// on (Admin → Settings). Admins never see it.
import { Box, Button, Typography } from "@mui/material";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const HEAD = '"Inter", sans-serif';

export default function MaintenanceScreen({ settings }) {
  const { maintenanceMessage, supportEmail, supportPhone } = settings || {};
  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "#faf7f3" }}>
      <Box sx={{ width: "100%", maxWidth: 460, textAlign: "center", bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: "22px", p: { xs: 3, sm: 4 } }}>
        <Box component="img" src="/KwartoKeeper-Icon.png" alt="KwartoKeeper" sx={{ height: 36, width: 36, mb: 2 }} />
        <Box sx={{ width: 64, height: 64, borderRadius: "18px", mx: "auto", mb: 2, display: "grid", placeItems: "center", bgcolor: "rgba(237,108,2,.12)", color: "warning.main" }}>
          <ConstructionOutlinedIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography component="h1" sx={{ fontFamily: HEAD, fontWeight: 900, fontSize: "1.5rem", letterSpacing: "-0.02em" }}>
          We&apos;ll be right back
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: "pre-line", lineHeight: 1.6 }}>
          {maintenanceMessage}
        </Typography>

        {(supportEmail || supportPhone) && (
          <Box sx={{ mt: 2.5, display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Need help in the meantime?
            </Typography>
            {supportEmail && (
              <Button size="small" startIcon={<MailOutlineIcon />} href={`mailto:${supportEmail}`} sx={{ fontWeight: 700, textTransform: "none" }}>
                {supportEmail}
              </Button>
            )}
            {supportPhone && (
              <Button size="small" startIcon={<PhoneOutlinedIcon />} href={`tel:${supportPhone}`} sx={{ fontWeight: 700, textTransform: "none" }}>
                {supportPhone}
              </Button>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 1, mt: 3, flexDirection: { xs: "column", sm: "row" } }}>
          <Button fullWidth variant="contained" disableElevation startIcon={<RefreshIcon />} onClick={() => window.location.reload()} sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 44 }}>
            Try again
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={async () => {
              await signOut(auth).catch(() => {});
              window.location.assign("/login");
            }}
            sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 44, borderColor: "divider" }}
          >
            Log out
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
