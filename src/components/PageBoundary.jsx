// Wraps each page: shows a spinner while the page's code downloads (pages load
// on demand, see App.jsx), and a "Something went wrong" card instead of a blank
// screen if the page crashes. Going to another page clears the error.
import React, { Suspense } from "react";
import { useLocation } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { t } from "../i18n";

export function PageLoader({ fullScreen = false }) {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: fullScreen ? "100vh" : 320 }} role="status" aria-label={t("Loading")}>
      <CircularProgress />
    </Box>
  );
}

// A new version of the app was published while this tab was open: the old page files are gone
const isStaleChunk = (error) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(error?.message || error));

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error("Page error:", error);
  }
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isStaleChunk(error);
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: 360, px: 2 }}>
        <Box sx={{ maxWidth: 420, textAlign: "center", bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: "18px", p: { xs: 3, sm: 4 } }}>
          <Box sx={{ width: 52, height: 52, mx: "auto", mb: 2, borderRadius: "14px", display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
            <ErrorOutlineRoundedIcon />
          </Box>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.15rem", mb: 0.75 }}>
            {stale ? t("KwartoKeeper was updated") : t("Something went wrong")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {stale ? t("Reload to get the latest version.") : t("This page couldn't be shown. Your information is safe. Reload to try again, or go to another page.")}
          </Typography>
          <Button variant="contained" disableElevation startIcon={<RefreshOutlinedIcon />} onClick={() => window.location.reload()} sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 44 }}>
            {t("Reload")}
          </Button>
        </Box>
      </Box>
    );
  }
}

export default function PageBoundary({ children, fullScreen = false }) {
  const { pathname } = useLocation();
  return (
    <Boundary resetKey={pathname}>
      <Suspense fallback={<PageLoader fullScreen={fullScreen} />}>{children}</Suspense>
    </Boundary>
  );
}
