// The KwartoKeeper waiting screen: the logo over a row of rooms lighting up
// one by one (the same squares as the property cover). Used while the app
// checks who is signed in and while a page's code downloads. index.html has a
// plain-HTML copy for the moments before the app itself has loaded.
import { Box, GlobalStyles, Typography } from "@mui/material";
import BrandLogo from "./BrandLogo";
import { t } from "../i18n";

const ORANGE = "#ff4500";

const keyframes = (
  <GlobalStyles
    styles={{
      "@keyframes kkLoaderRoom": {
        "0%, 100%": { backgroundColor: "rgba(32,32,32,.10)", transform: "scale(.86)" },
        "35%": { backgroundColor: ORANGE, transform: "scale(1)" },
        "70%": { backgroundColor: "rgba(32,32,32,.10)", transform: "scale(.86)" },
      },
      "@keyframes kkLoaderBreathe": {
        "0%, 100%": { transform: "translateY(0)" },
        "50%": { transform: "translateY(-3px)" },
      },
      "@media (prefers-reduced-motion: reduce)": {
        ".kk-loader *": { animation: "none !important" },
      },
    }}
  />
);

export default function BrandLoader({ fullScreen = true, label = t("Loading…") }) {
  return (
    <Box
      className="kk-loader"
      role="status"
      aria-live="polite"
      aria-label={label}
      sx={{
        minHeight: fullScreen ? "100dvh" : 320,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2.25,
        px: 2,
        bgcolor: fullScreen ? "background.default" : "transparent",
      }}
    >
      {keyframes}
      <BrandLogo variant="icon" appearance="light" sx={{ width: fullScreen ? 64 : 48, height: "auto", animation: "kkLoaderBreathe 1.6s ease-in-out infinite" }} />
      <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: "repeat(5, 10px)", gap: "6px" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: "rgba(32,32,32,.10)", animation: `kkLoaderRoom 1.25s ease-in-out ${i * 0.12}s infinite` }} />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: ".02em" }}>
        {label}
      </Typography>
    </Box>
  );
}
