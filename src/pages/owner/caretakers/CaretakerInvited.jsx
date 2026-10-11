// src/pages/owner/caretakers/CaretakerInvited.jsx
//
// Shown right after a caretaker account is created. This is the one place the
// temporary password is displayed, so the owner can relay it. Nothing is sent
// automatically except the optional SMS (see InviteCaretaker.jsx); the owner
// shares the login through whatever messaging app they already use.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";

const row = { display: "flex", alignItems: "center" };

function CredentialRow({ label, value, secret, onCopy, copied }) {
  const [show, setShow] = useState(false);
  const hidden = secret && !show;
  return (
    <Box sx={{ ...row, gap: 1, py: 1.25 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontWeight: 700,
            overflowWrap: "anywhere",
            fontFamily: secret ? '"Roboto Mono", ui-monospace, monospace' : undefined,
            letterSpacing: secret && !hidden ? 0.5 : undefined,
          }}
        >
          {hidden ? "•".repeat(Math.min(value.length, 12)) : value}
        </Typography>
      </Box>
      {secret && (
        <IconButton aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>
          {show ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      )}
      <Tooltip title={copied ? "Copied" : "Copy"}>
        <IconButton aria-label={`Copy ${label.toLowerCase()}`} onClick={onCopy} color={copied ? "success" : "default"}>
          {copied ? <CheckCircleOutlinedIcon /> : <ContentCopyOutlinedIcon />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function CaretakerInvited() {
  const { state, pathname } = useLocation();
  const navigate = useNavigate();

  // Keep what we were given in local state, then wipe it from the browser's
  // history entry so the password isn't left behind after a refresh or "back".
  const [info] = useState(() => state || null);
  useEffect(() => {
    if (state) navigate(pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [copiedKey, setCopiedKey] = useState("");

  if (!info?.email || !info?.tempPassword) {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", p: { xs: 0, sm: 3 }, textAlign: "center" }}>
        <Alert severity="info" sx={{ textAlign: "left", mb: 2, borderRadius: 2 }}>
          There's nothing to show here. For security, a caretaker's temporary password is only displayed once, right after the account is created.
        </Alert>
        <Button variant="contained" onClick={() => navigate("/owner/caretakers")} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
          Back to caretakers
        </Button>
      </Box>
    );
  }

  const { email, tempPassword, fullName, phone, smsStatus, smsError } = info;

  const shareText = [
    "KwartoKeeper caretaker account",
    fullName ? `Name: ${fullName}` : null,
    `Username: ${email}`,
    `Temporary password: ${tempPassword}`,
    `Sign in at: ${window.location.origin}/login`,
  ]
    .filter(Boolean)
    .join("\n");

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? "" : k)), 2000);
    } catch {
      // clipboard blocked (e.g. not HTTPS): the visible values can still be copied by hand
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Caretaker account", text: shareText });
        return;
      } catch {
        // cancelled, or not supported for this content: fall back to copying
      }
    }
    copy("all", shareText);
  };

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", p: { xs: 0, sm: 3 } }}>
      <Box sx={{ textAlign: "center", mb: 3 }}>
        <Box
          sx={{
            width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 1.5, ...row, justifyContent: "center",
            bgcolor: "rgba(76, 175, 80, 0.14)", color: "success.main",
          }}
        >
          <CheckCircleOutlinedIcon sx={{ fontSize: 36 }} />
        </Box>
        <Typography component="h1" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.4rem", sm: "1.7rem" } }}>
          Caretaker account created
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {fullName ? `${fullName} can now sign in.` : "They can now sign in."} Share their login below.
        </Typography>
      </Box>

      {smsStatus === "sent" && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          Text sent{phone ? ` to ${phone}` : ""}. Keep the details below in case it doesn't arrive.
        </Alert>
      )}
      {smsStatus === "failed" && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {smsError || "The text couldn't be sent."} The account was still created, so share the login yourself with the buttons below.
        </Alert>
      )}

      <Paper elevation={0} sx={{ px: 2, py: 0.5, mb: 2, bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CredentialRow label="Username" value={email} onCopy={() => copy("email", email)} copied={copiedKey === "email"} />
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />
        <CredentialRow label="Temporary password" value={tempPassword} secret onCopy={() => copy("pw", tempPassword)} copied={copiedKey === "pw"} />
      </Paper>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        This is the only time the password is shown. Share it now, and ask them to change it after signing in.
      </Alert>

      <Stack spacing={1.25}>
        <Button variant="contained" size="large" fullWidth startIcon={<ShareOutlinedIcon />} onClick={handleShare} sx={{ fontWeight: 700, borderRadius: 2.5, minHeight: 48 }}>
          {copiedKey === "all" ? "Copied to clipboard" : "Share login"}
        </Button>
        <Button variant="outlined" fullWidth startIcon={<ContentCopyOutlinedIcon />} onClick={() => copy("all", shareText)} sx={{ fontWeight: 700, borderRadius: 2.5, minHeight: 44 }}>
          Copy all details
        </Button>
        <Button fullWidth startIcon={<PersonAddAltOutlinedIcon />} onClick={() => navigate("/owner/caretakers/invite")} sx={{ fontWeight: 700, minHeight: 44 }}>
          Invite another caretaker
        </Button>
        <Button fullWidth color="inherit" onClick={() => navigate("/owner/caretakers")} sx={{ fontWeight: 700, minHeight: 44 }}>
          Back to caretaker list
        </Button>
      </Stack>
    </Box>
  );
}