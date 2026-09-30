// src/pages/owner/CaretakerInvited.jsx
//
// Confirmation screen shown after a caretaker account is created. Displays
// the temporary credentials so the owner can relay them manually.
//
// NOTE ON "Send SMS Invite": there is no SMS gateway wired up (no Twilio,
// Semaphore, etc. in this project's scope). "Share via Messaging Apps" below
// uses the Web Share API where available (falls back to copy-to-clipboard),
// so the owner shares the credentials through whatever messaging app they
// already have installed (Messenger, SMS, etc.) rather than the system
// sending anything automatically.

import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Paper, Stack, Button, Alert } from "@mui/material";
import { useState } from "react";

export default function CaretakerInvited() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const email = state?.email || "";
  const tempPassword = state?.tempPassword || "";

  const shareText = `KwartoKeeper Caretaker Account\nUsername: ${email}\nTemporary Password: ${tempPassword}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Caretaker Account", text: shareText });
        return;
      } catch (err) {
        // user cancelled the share sheet, or share failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // clipboard blocked (e.g. no HTTPS in some test environments) — nothing more we can do here
    }
  };

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", p: 3, textAlign: "center" }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Caretaker Invited!
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3, textAlign: "left" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Temporary Account Card:
        </Typography>
        <Typography variant="body1">Username: {email}</Typography>
        <Typography variant="body1">
          Temporary Password: {tempPassword}
        </Typography>
      </Paper>

      {copied && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Copied to clipboard.
        </Alert>
      )}

      <Stack spacing={1.5}>
        <Button variant="contained" fullWidth onClick={handleShare}>
          Share via Messaging Apps
        </Button>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => navigate("/owner/caretakers")}
        >
          Back to Caretaker List
        </Button>
      </Stack>
    </Box>
  );
}
