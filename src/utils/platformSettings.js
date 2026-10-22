// Platform-wide settings an admin controls (Admin → Settings), stored in
// settings/global. Read once per page load and shared, so every guard and
// screen sees the same values without each one hitting Firestore.
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export const SETTINGS_DEFAULTS = {
  maintenanceMode: false,
  maintenanceMessage: "KwartoKeeper is down for scheduled maintenance. Please check back soon.",
  supportEmail: "",
  supportPhone: "",
  autoApproveOwners: false,
  maxPropertiesPerOwner: 20,
};

export const normalizeSettings = (data = {}) => ({
  maintenanceMode: Boolean(data.maintenanceMode),
  maintenanceMessage: String(data.maintenanceMessage || SETTINGS_DEFAULTS.maintenanceMessage),
  supportEmail: String(data.supportEmail || ""),
  supportPhone: String(data.supportPhone || ""),
  autoApproveOwners: Boolean(data.autoApproveOwners),
  maxPropertiesPerOwner: Math.max(1, Math.floor(Number(data.maxPropertiesPerOwner)) || SETTINGS_DEFAULTS.maxPropertiesPerOwner),
});

let cache = null; // { at, promise }
const MAX_AGE_MS = 60 * 1000; // re-read after a minute, so turning maintenance off takes effect soon

/** Resolves to the normalized settings; never throws (falls back to the defaults). */
export function loadPlatformSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < MAX_AGE_MS) return cache.promise;
  const promise = getDoc(doc(db, "settings", "global"))
    .then((snap) => normalizeSettings(snap.exists() ? snap.data() : {}))
    .catch((err) => {
      console.warn("Platform settings unavailable, using defaults:", err?.code || err);
      return normalizeSettings({});
    });
  cache = { at: Date.now(), promise };
  return promise;
}

/** Call after an admin saves, so this tab sees the new values right away. */
export function forgetPlatformSettings() {
  cache = null;
}
