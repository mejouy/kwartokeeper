// A list's sort choice, remembered on this device (a convenience: if storage
// is blocked it simply starts at the default each time).
import { useState } from "react";
import { DEFAULT_TICKET_SORT, TICKET_SORTS } from "./maintenancePrioritization";

export function useStoredSort(key, fallback = DEFAULT_TICKET_SORT) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return TICKET_SORTS.some((s) => s.key === saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (next) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      /* storage blocked: keep it for this visit only */
    }
  };
  return [value, set];
}
