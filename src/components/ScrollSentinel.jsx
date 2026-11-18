import { useEffect, useRef } from "react";
import { Box } from "@mui/material";

export default function ScrollSentinel({ enabled, onVisible, resetKey }) {
  const ref = useRef(null);
  const onVisibleRef = useRef(onVisible);

  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisibleRef.current();
        }
      },
      { rootMargin: "0px 0px 240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, resetKey]);

  return <Box ref={ref} aria-hidden="true" sx={{ height: 1 }} />;
}
