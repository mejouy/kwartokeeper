import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Button, Container, GlobalStyles } from "@mui/material";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

// Shown right after an owner registers, before the setup wizard,
// so the jump into a multi-step form isn't sudden.

const BRAND = "#ff4500";
const INK = "#202020";
const SOFT = "#cadcf6";
const LINE = "rgba(255,255,255,0.12)";

const STEPS = [
  {
    title: "Basic details",
    body: "Name your property, add its address and tell us how it's run.",
  },
  {
    title: "Rules and amenities",
    body: "Set house rules, curfew and what's included, like Wi-Fi or laundry.",
  },
  {
    title: "Rooms and layout",
    body: "Add your rooms and how many beds each one has.",
  },
];

// 5 columns x 6 rows. 1 = a room that lights up.
const COLS = 5;
const ROWS = 6;
const LIT = [
  0, 0, 1, 0, 0,
  0, 1, 1, 0, 1,
  0, 0, 0, 1, 0,
  1, 0, 1, 0, 0,
  0, 1, 0, 0, 1,
  0, 0, 1, 0, 0,
];

// The building fills in room by room, as the owner's will.
function Building() {
  const cells = useMemo(() => {
    const size = 34;
    const gap = 16;
    let n = 0;
    return Array.from({ length: COLS * ROWS }, (_, i) => {
      const lit = LIT[i] === 1;
      const order = lit ? n++ : -1;
      return {
        x: (i % COLS) * (size + gap),
        y: Math.floor(i / COLS) * (size + gap),
        size,
        lit,
        order,
      };
    });
  }, []);
  const w = COLS * 50 - 16;
  const h = ROWS * 50 - 16;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label="A dormitory building at night. Rooms light up one by one."
      style={{ display: "block", maxWidth: "100%" }}
    >
      {cells.map((c, i) => (
        <rect
          key={i}
          className={c.lit ? "kk-room kk-room-lit" : "kk-room"}
          style={c.lit ? { animationDelay: `${0.5 + c.order * 0.22}s` } : undefined}
          x={c.x}
          y={c.y}
          width={c.size}
          height={c.size}
          rx={5}
        />
      ))}
    </svg>
  );
}

export default function OwnerWelcome() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    let alive = true;
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        const name = snap.exists() ? snap.data().fullName : "";
        if (alive && name) setFirstName(String(name).trim().split(/\s+/)[0]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: INK,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <GlobalStyles
        styles={{
          ".kk-room": { fill: "rgba(202,220,246,0.14)" },
          ".kk-room-lit": {
            animation: "kkLight 0.5s ease-out forwards",
            fill: "rgba(202,220,246,0.14)",
          },
          "@keyframes kkLight": {
            from: { fill: "rgba(202,220,246,0.14)" },
            to: { fill: BRAND },
          },
          "@media (prefers-reduced-motion: reduce)": {
            ".kk-room-lit": { animation: "none", fill: BRAND },
          },
        }}
      />

      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          pt: { xs: 3, md: 6 },
          px: { xs: 2.5, sm: 4 },
        }}
      >
        <Box
          component="img"
          src="/KwartoKeeper-DarkMode-Icon.png"
          alt="KwartoKeeper"
          sx={{ height: { xs: 30, md: 38 }, alignSelf: "flex-start" }}
        />

        <Box
          sx={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0,5fr) minmax(0,6fr)" },
            columnGap: { md: 8 },
            alignItems: { md: "center" },
            py: { xs: 4, md: 6 },
          }}
        >
          {/* Left: building + headline */}
          <Box>
            <Box
              sx={{
                width: { xs: 120, sm: 150, md: 240 },
                mb: { xs: 3, md: 4 },
              }}
            >
              <Building />
            </Box>
            <Typography
              component="h1"
              sx={{
                fontWeight: 900,
                fontSize: { xs: "1.9rem", sm: "2.3rem", md: "2.7rem" },
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                textWrap: "balance",
                mb: 1.5,
              }}
            >
              {firstName ? `Welcome, ${firstName}.` : "Welcome to KwartoKeeper."}
              <br />
              Let's set up your property.
            </Typography>
            <Typography sx={{ color: SOFT, maxWidth: 420, lineHeight: 1.6 }}>
              Your account is ready. Three short steps and a few minutes, then you can
              add tenants and caretakers.
            </Typography>
          </Box>

          {/* Right: steps + review note */}
          <Box sx={{ mt: { xs: 4, md: 0 } }}>
            <Box component="ol" sx={{ listStyle: "none", p: 0, m: 0 }}>
              {STEPS.map((s, i) => (
                <Box
                  component="li"
                  key={s.title}
                  sx={{
                    position: "relative",
                    display: "flex",
                    gap: 2,
                    pb: i === STEPS.length - 1 ? 0 : 3,
                    // line joining the step markers
                    "&::before":
                      i === STEPS.length - 1
                        ? undefined
                        : {
                            content: '""',
                            position: "absolute",
                            left: 15,
                            top: 34,
                            bottom: 2,
                            width: 2,
                            bgcolor: LINE,
                          },
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      flex: "0 0 auto",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      bgcolor: i === 0 ? BRAND : INK,
                      color: "#fff",
                      border: `2px solid ${i === 0 ? BRAND : "rgba(255,255,255,0.28)"}`,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Box sx={{ pt: 0.25, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
                      {s.title}
                    </Typography>
                    <Typography sx={{ color: SOFT, fontSize: "0.92rem", lineHeight: 1.55 }}>
                      {s.body}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                mt: 4,
                p: 2.25,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.05)",
                border: `1px solid ${LINE}`,
              }}
            >
              <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", mb: 0.5 }}>
                We review every new owner account
              </Typography>
              <Typography sx={{ color: SOFT, fontSize: "0.88rem", lineHeight: 1.55 }}>
                You can finish setup now. We'll let you know once you're approved.
              </Typography>
            </Box>

            {/* Desktop button sits with the content */}
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate("/setup")}
              sx={{
                display: { xs: "none", md: "inline-flex" },
                mt: 4,
                px: 5,
                py: 1.4,
                fontWeight: 700,
                bgcolor: BRAND,
                color: "#fff",
                "&:hover": { bgcolor: "#e03d00" },
              }}
            >
              Start setting up
            </Button>
          </Box>
        </Box>
      </Container>

      {/* Mobile: button stays in thumb reach */}
      <Box
        sx={{
          display: { xs: "block", md: "none" },
          position: "sticky",
          bottom: 0,
          px: 2.5,
          pt: 1.5,
          pb: "max(16px, env(safe-area-inset-bottom))",
          bgcolor: INK,
          borderTop: `1px solid ${LINE}`,
        }}
      >
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => navigate("/setup")}
          sx={{
            py: 1.5,
            fontWeight: 700,
            bgcolor: BRAND,
            color: "#fff",
            "&:hover": { bgcolor: "#e03d00" },
          }}
        >
          Start setting up
        </Button>
      </Box>
    </Box>
  );
}