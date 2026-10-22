// src/pages/owner/caretakers/CaretakerInvited.jsx
//
// Shown right after a caretaker account is created. This is the one place the
// temporary password is displayed, so the owner can relay it. Nothing is sent
// automatically except the optional SMS (see InviteCaretaker.jsx); the owner
// shares the login through whatever messaging app they already use.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";

const HEAD = '"Inter", sans-serif';
const MONO = '"Roboto Mono", ui-monospace, Menlo, Consolas, monospace';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const row = { display: "flex", alignItems: "center" };
const panelSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg, minWidth: 0 };

function CredentialRow({ label, value, secret, onCopy, copied }) {
  const [show, setShow] = useState(true);
  const hidden = secret && !show;
  return (
    <Box sx={{ ...row, gap: 1, px: { xs: 1.75, sm: 2.25 }, py: 1.5 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 11 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: secret ? { xs: "1.15rem", sm: "1.3rem" } : "1rem",
            overflowWrap: "anywhere",
            fontFamily: secret ? MONO : undefined,
            letterSpacing: secret && !hidden ? "0.06em" : undefined,
            mt: 0.25,
          }}
        >
          {hidden ? "•".repeat(Math.min(value.length, 12)) : value}
        </Typography>
      </Box>
      {secret && (
        <Tooltip title={show ? "Hide" : "Show"}>
          <IconButton aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>
            {show ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={copied ? "Copied" : "Copy"}>
        <IconButton
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={onCopy}
          sx={{ border: "1px solid", borderColor: copied ? "success.main" : "divider", borderRadius: R.sm, color: copied ? "success.main" : "text.secondary" }}
        >
          {copied ? <CheckIcon fontSize="small" /> : <ContentCopyOutlinedIcon fontSize="small" />}
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
  // Once the login has been copied, shared or texted, leaving is safe
  const [handedOff, setHandedOff] = useState(false);
  const hasLogin = Boolean(info?.email && info?.tempPassword);

  // The password can't be shown again, so warn before a refresh / closed tab loses it
  useEffect(() => {
    if (!hasLogin || handedOff) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasLogin, handedOff]);

  if (!hasLogin) {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: { xs: 2, md: 6 } }}>
        <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3.5 }, textAlign: "center" }}>
          <Box sx={{ width: 56, height: 56, borderRadius: R.md, mx: "auto", mb: 1.5, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
            <KeyOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.15rem" }}>Nothing to show here</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            For security, a caretaker's temporary password is only shown once, right after the account is created. If it was lost, you can invite them again with a different email.
          </Typography>
          <Button variant="contained" disableElevation onClick={() => navigate("/owner/caretakers")} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 44 }}>
            Back to caretakers
          </Button>
        </Box>
      </Box>
    );
  }

  const { email, tempPassword, fullName, phone, smsStatus, smsError, propertyName, permissionCount, resent } = info;
  const firstName = String(fullName || "").trim().split(/\s+/)[0] || "";
  const loginUrl = `${window.location.origin}/login`;

  const shareText = [
    resent
      ? `Hi${firstName ? ` ${firstName}` : ""}! Here's a new KwartoKeeper password for your caretaker account${propertyName ? ` at ${propertyName}` : ""}. The old one no longer works:`
      : `Hi${firstName ? ` ${firstName}` : ""}! Here's your KwartoKeeper caretaker login${propertyName ? ` for ${propertyName}` : ""}:`,
    "",
    `Email: ${email}`,
    `Temporary password: ${tempPassword}`,
    "",
    `Sign in at ${loginUrl}`,
    "You'll be asked to choose your own password the first time you sign in.",
  ].join("\n");

  const markCopied = (key) => {
    setCopiedKey(key);
    setHandedOff(true);
    setTimeout(() => setCopiedKey((k) => (k === key ? "" : k)), 2000);
  };

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(key);
    } catch {
      // clipboard blocked (e.g. not HTTPS): the visible values can still be copied by hand
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Caretaker login", text: shareText });
        setHandedOff(true);
        return;
      } catch (err) {
        if (err?.name === "AbortError") return; // they closed the share sheet
      }
    }
    copy("all", shareText);
  };

  // Opens the phone's messaging app with the message filled in
  const smsHref = phone ? `sms:${String(phone).replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(shareText)}` : "";

  const leave = (to) => {
    if (!handedOff && !window.confirm("You haven't copied or shared the login yet. The password can't be shown again. Leave anyway?")) return;
    navigate(to);
  };

  const steps = [
    { icon: ShareOutlinedIcon, title: "Send them the login", body: "Share it below, or tell them in person." },
    { icon: LoginOutlinedIcon, title: "They sign in", body: `On a phone or computer at ${window.location.host}/login` },
    { icon: LockResetOutlinedIcon, title: "They choose their own password", body: "The app asks them right after their first sign-in, so the temporary one stops working." },
  ];

  return (
    <Box sx={{ maxWidth: 980, mx: "auto" }}>
      {/* ───── Header ───── */}
      <Box component="section" sx={{ ...panelSx, position: "relative", overflow: "hidden", borderRadius: R.xl, p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />
        <Box sx={{ position: "relative", display: "flex", alignItems: { xs: "flex-start", sm: "center" }, gap: 2 }}>
          <Box sx={{ width: { xs: 48, sm: 60 }, height: { xs: 48, sm: 60 }, flexShrink: 0, borderRadius: R.md, display: "grid", placeItems: "center", bgcolor: (t) => alpha(t.palette.success.main, 0.12), color: "success.main" }}>
            <CheckCircleOutlinedIcon sx={{ fontSize: { xs: 28, sm: 34 } }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h1" sx={{ fontFamily: HEAD, fontWeight: 900, letterSpacing: "-0.02em", fontSize: { xs: "1.3rem", sm: "1.7rem" }, lineHeight: 1.2 }}>
              {resent ? `New password for ${fullName || "your caretaker"}` : fullName ? `${fullName} is set up` : "Caretaker account created"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {resent
                ? "Their old password stopped working. Send them this one; it's the only time it's shown."
                : "Send them the login below. This is the only time the password is shown."}
            </Typography>
            {(propertyName || typeof permissionCount === "number") && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
                {propertyName && (
                  <Box component="span" sx={{ ...row, gap: 0.5, px: 1, height: 26, borderRadius: 99, fontSize: 12.5, fontWeight: 700, bgcolor: (t) => alpha(t.palette.text.primary, 0.06), color: "text.secondary", "& svg": { fontSize: 15 } }}>
                    <HomeWorkOutlinedIcon /> {propertyName}
                  </Box>
                )}
                {typeof permissionCount === "number" && (
                  <Box component="span" sx={{ ...row, gap: 0.5, px: 1, height: 26, borderRadius: 99, fontSize: 12.5, fontWeight: 700, bgcolor: (t) => alpha(t.palette.text.primary, 0.06), color: "text.secondary", "& svg": { fontSize: 15 } }}>
                    <SecurityOutlinedIcon /> {permissionCount} of 5 permissions
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {smsStatus === "sent" && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: R.md }}>
          Text sent{phone ? ` to ${phone}` : ""}. Keep the details below in case it doesn't arrive.
        </Alert>
      )}
      {smsStatus === "failed" && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: R.md }}>
          {smsError || "The text couldn't be sent."} The account was still created, so share the login yourself below.
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.25fr) minmax(0, 1fr)" }, gap: { xs: 2, sm: 2.5 }, alignItems: "start" }}>
        {/* ───── Login + share ───── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Box sx={{ ...panelSx, overflow: "hidden" }}>
            <Box sx={{ ...row, gap: 1, px: { xs: 1.75, sm: 2.25 }, py: 1.25, bgcolor: (t) => alpha(t.palette.background.paper, 0.55), borderBottom: "1px solid", borderColor: "divider" }}>
              <KeyOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />
              <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }}>Their login</Typography>
              {!handedOff && (
                <Typography variant="caption" sx={{ fontWeight: 700, color: "warning.dark" }}>
                  Not shared yet
                </Typography>
              )}
              {handedOff && (
                <Typography variant="caption" sx={{ ...row, gap: 0.5, fontWeight: 700, color: "success.dark" }}>
                  <CheckIcon sx={{ fontSize: 15 }} /> Shared
                </Typography>
              )}
            </Box>
            <CredentialRow label="Email" value={email} onCopy={() => copy("email", email)} copied={copiedKey === "email"} />
            <Box sx={{ borderTop: "1px dashed", borderColor: "divider", mx: { xs: 1.75, sm: 2.25 } }} />
            <CredentialRow label="Temporary password" value={tempPassword} secret onCopy={() => copy("pw", tempPassword)} copied={copiedKey === "pw"} />
          </Box>

          <Box sx={{ ...panelSx, p: { xs: 1.75, sm: 2.25 } }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1 }}>Message to send</Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                borderRadius: R.md,
                bgcolor: (t) => alpha(t.palette.background.paper, 0.55),
                fontFamily: "inherit",
                fontSize: 13.5,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                color: "text.primary",
              }}
            >
              {shareText}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: smsHref ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))" }, gap: 1, mt: 1.5 }}>
              <Button variant="contained" disableElevation startIcon={<ShareOutlinedIcon />} onClick={handleShare} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 46 }}>
                {copiedKey === "all" ? "Copied" : "Share"}
              </Button>
              {smsHref && (
                <Button variant="outlined" startIcon={<SmsOutlinedIcon />} href={smsHref} onClick={() => setHandedOff(true)} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 46 }}>
                  Text {phone}
                </Button>
              )}
              <Button variant="outlined" color="inherit" startIcon={copiedKey === "msg" ? <CheckIcon /> : <ContentCopyOutlinedIcon />} onClick={() => copy("msg", shareText)} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 46, borderColor: "divider" }}>
                {copiedKey === "msg" ? "Copied" : "Copy message"}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* ───── What happens next + actions ───── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Box sx={{ ...panelSx, p: { xs: 1.75, sm: 2.25 } }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.5 }}>What happens next</Typography>
            <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {steps.map((s, i) => {
                const Icon = s.icon;
                const done = i === 0 && handedOff;
                return (
                  <Box
                    component="li"
                    key={s.title}
                    sx={{
                      position: "relative",
                      display: "flex",
                      gap: 1.5,
                      pb: i === steps.length - 1 ? 0 : 2,
                      "&::before": i === steps.length - 1 ? undefined : { content: '""', position: "absolute", left: 15, top: 34, bottom: 2, width: 2, borderRadius: 2, bgcolor: "divider" },
                    }}
                  >
                    <Box sx={{ width: 32, height: 32, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: done ? "success.main" : i === 0 ? "primary.main" : (t) => alpha(t.palette.text.primary, 0.06), color: done || i === 0 ? "#fff" : "text.secondary" }}>
                      {done ? <CheckIcon sx={{ fontSize: 18 }} /> : <Icon sx={{ fontSize: 17 }} />}
                    </Box>
                    <Box sx={{ minWidth: 0, pt: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{s.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.45, overflowWrap: "anywhere" }}>
                        {s.body}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
              Until they sign in, their card on the Caretakers page shows "Not logged in yet".
            </Typography>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Button variant="outlined" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => leave("/owner/caretakers/invite")} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 46, bgcolor: "background.default" }}>
              Invite another caretaker
            </Button>
            <Button color="inherit" onClick={() => leave("/owner/caretakers")} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 46 }}>
              Done, back to caretakers
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
