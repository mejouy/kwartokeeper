// English / Filipino toggle. The choice is kept on this phone or browser; switching reloads the page.
import { Box } from "@mui/material";
import { lang, setLanguage } from "../i18n";

const OPTIONS = [
  { id: "en", label: "English" },
  { id: "fil", label: "Filipino" },
];

export default function LanguageSwitch({ sx }) {
  return (
    <Box role="group" aria-label="Language / Wika" sx={{ display: "inline-flex", p: 0.5, gap: 0.5, borderRadius: 99, border: "1px solid", borderColor: "divider", bgcolor: "background.default", ...sx }}>
      {OPTIONS.map((o) => {
        const on = lang === o.id;
        return (
          <Box
            key={o.id}
            component="button"
            type="button"
            lang={o.id}
            aria-pressed={on}
            onClick={() => setLanguage(o.id)}
            sx={{
              minHeight: 36,
              px: 1.75,
              borderRadius: 99,
              border: 0,
              font: "inherit",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: on ? "default" : "pointer",
              bgcolor: on ? "text.primary" : "transparent",
              color: on ? "background.default" : "text.secondary",
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}
