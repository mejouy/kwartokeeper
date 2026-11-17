// Separate rates per bed (panel revisions, client: "yung rates ng beds pwede
// iseparate"). A room keeps one usual rate (monthlyRatePerBed); any bed can
// have its own rate in room.bedRates, e.g. { "Bed 1": 3500 } for the bed by the
// window. A bed without its own rate uses the room's rate.

export const bedLabel = (n) => `Bed ${n}`;
export const bedLabels = (capacity) => Array.from({ length: Math.max(Number(capacity) || 0, 0) }, (_, i) => bedLabel(i + 1));

/** The monthly rate for one bed in a room. */
export function bedRateOf(room, bedId) {
  const own = Number(room?.bedRates?.[bedId]);
  return own > 0 ? own : Number(room?.monthlyRatePerBed) || 0;
}

/** Beds that have a rate of their own (different from the room's rate). */
export function customBedRates(room) {
  const base = Number(room?.monthlyRatePerBed) || 0;
  return Object.entries(room?.bedRates || {}).filter(([, v]) => Number(v) > 0 && Number(v) !== base);
}

/** Lowest and highest bed rate in a room: { min, max } (equal when every bed costs the same). */
export function roomRateRange(room) {
  const rates = bedLabels(room?.capacity).map((b) => bedRateOf(room, b)).filter((r) => r > 0);
  if (!rates.length) {
    const base = Number(room?.monthlyRatePerBed) || 0;
    return { min: base, max: base };
  }
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

/** Keeps only real beds of the room (Bed 1…capacity) with a rate above zero that differs from the room's rate. */
export function cleanBedRates(bedRates, capacity, baseRate) {
  const beds = new Set(bedLabels(capacity));
  const base = Number(baseRate) || 0;
  return Object.fromEntries(
    Object.entries(bedRates || {})
      .map(([bed, v]) => [bed, Math.round((Number(v) || 0) * 100) / 100])
      .filter(([bed, v]) => beds.has(bed) && v > 0 && v !== base)
  );
}

/** "₱3,000" or "₱3,000–₱3,500" for a room. */
export function rateRangeText(room) {
  const { min, max } = roomRateRange(room);
  const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;
  return min === max ? peso(min) : `${peso(min)}–${peso(max)}`;
}
