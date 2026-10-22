// One occupancy rule for the whole app (dashboard, Properties, property profile,
// reports and the room records), so every page shows the same numbers.
//
// A tenant HOLDS A BED while their record is Active or Pending: a pending tenant
// has been registered into a bed that can't be given to anyone else (the
// register form already treats it as taken). Former tenants (inactive, archived,
// moved out...) don't. Pending tenants are also reported separately as
// "moving in", so the dashboard can say how many haven't finished signing up.
import { normalizeStatus } from "./tenantRent";
import { isRemovedAccount } from "./accountState";

export const holdsBed = (tenant) => !isRemovedAccount(tenant) && normalizeStatus(tenant?.status) !== "Inactive";
export const isMovingIn = (tenant) => normalizeStatus(tenant?.status) === "Pending";
export const tenantPropertyId = (tenant) => tenant?.propertyId || tenant?.assignedPropertyId || "";

// Beds in a property: the rooms' capacities, else the property's own total
export function bedsInProperty(property) {
  const rooms = Array.isArray(property?.rooms) ? property.rooms : [];
  const fromRooms = rooms.reduce((sum, room) => sum + (Number(room?.capacity || room?.beds || room?.totalBeds || 0) || 0), 0);
  if (fromRooms > 0) return fromRooms;
  return Number(property?.totalBeds) || Number(property?.capacity) || Number(property?.beds) || Number(property?.totalCapacity) || 0;
}

/**
 * Occupancy from bed assignments: only tenants assigned to one of these
 * properties count, and a property never shows more occupied beds than it has.
 * @param properties [{ id, beds? , rooms?, totalBeds? }]
 * @param tenants    merged tenant records
 * @returns { byProperty: Map(id -> {beds, occupied, movingIn, vacant, rate}), beds, occupied, movingIn, vacant, rate }
 */
export function occupancyOf(properties, tenants) {
  const byProperty = new Map();
  (properties || []).forEach((p) => {
    byProperty.set(p.id, { beds: p.beds ?? bedsInProperty(p), held: 0, movingIn: 0 });
  });
  (tenants || []).forEach((t) => {
    const entry = byProperty.get(tenantPropertyId(t));
    if (!entry || !holdsBed(t)) return;
    entry.held += 1;
    if (isMovingIn(t)) entry.movingIn += 1;
  });

  let beds = 0;
  let occupied = 0;
  let movingIn = 0;
  byProperty.forEach((entry, id) => {
    // A property with no beds set up yet still shows who's assigned to it
    const occ = entry.beds > 0 ? Math.min(entry.held, entry.beds) : entry.held;
    const result = {
      beds: entry.beds,
      occupied: occ,
      movingIn: Math.min(entry.movingIn, occ),
      vacant: Math.max(entry.beds - occ, 0),
      overCapacity: Math.max(entry.held - entry.beds, 0) * (entry.beds > 0 ? 1 : 0),
      rate: entry.beds > 0 ? Math.round((occ / entry.beds) * 100) : 0,
    };
    byProperty.set(id, result);
    beds += result.beds;
    occupied += result.beds > 0 ? result.occupied : 0;
    movingIn += result.beds > 0 ? result.movingIn : 0;
  });

  return { byProperty, beds, occupied, movingIn, vacant: Math.max(beds - occupied, 0), rate: beds > 0 ? Math.round((occupied / beds) * 100) : 0 };
}
