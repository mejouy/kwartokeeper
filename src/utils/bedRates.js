// Separate rates per bed (panel revisions, client: "yung rates ng beds pwede
// iseparate"). A room keeps one usual rate (monthlyRatePerBed); any bed can
// have its own rate in room.bedRates, e.g. { "Bed 1": 3500 } for the bed by the
// window. A bed without its own rate uses the room's rate.

import { t } from "../i18n";

export const bedLabel = (n) => `Bed ${n}`;
export const bedLabels = (capacity) => Array.from({ length: Math.max(Number(capacity) || 0, 0) }, (_, i) => bedLabel(i + 1));

export const BED_TYPE_SINGLE = "single";
export const BED_TYPE_DOUBLE_DECK_UPPER = "doubleDeckUpper";
export const BED_TYPE_DOUBLE_DECK_LOWER = "doubleDeckLower";
export const BED_LAYOUT_SINGLE = "single";
export const BED_LAYOUT_DOUBLE_DECK = "doubleDeck";

const BED_TYPES = new Set([
  BED_TYPE_SINGLE,
  BED_TYPE_DOUBLE_DECK_UPPER,
  BED_TYPE_DOUBLE_DECK_LOWER,
]);

/**
 * Default bed-space types for a room layout. Double deck pairs beds as
 * upper/lower bunks; with an odd bed count the last bed is a single bed.
 */
export function defaultBedTypes(capacity, layout = BED_LAYOUT_SINGLE) {
  if (layout !== BED_LAYOUT_DOUBLE_DECK) return {};
  return bedTypesForBunks(capacity, Math.floor((Number(capacity) || 0) / 2));
}

/**
 * Bed types for a room with `bunks` double decks: the first beds pair up as
 * upper/lower (Bed 1 upper, Bed 2 lower, ...), the rest are single beds.
 */
export function bedTypesForBunks(capacity, bunks) {
  const beds = bedLabels(capacity);
  const pairs = Math.min(Math.max(0, Math.floor(Number(bunks) || 0)), Math.floor(beds.length / 2));
  return Object.fromEntries(
    beds.slice(0, pairs * 2).map((bed, index) => [
      bed,
      index % 2 === 0 ? BED_TYPE_DOUBLE_DECK_UPPER : BED_TYPE_DOUBLE_DECK_LOWER,
    ])
  );
}

/** How many double decks a room has (complete upper/lower pairs). */
export function bunkCountOf(room, capacity = room?.capacity) {
  return bedSpaceGroups(room, capacity).filter((group) => group.kind === "doubleDeck").length;
}

/** Upper/lower bunk rates for a new room, only when it has bunks. */
export function defaultBedTypeRates(layout, { upperRate, lowerRate } = {}, baseRate) {
  if (layout !== BED_LAYOUT_DOUBLE_DECK) return {};
  return cleanBedTypeRates(
    { [BED_TYPE_DOUBLE_DECK_UPPER]: upperRate, [BED_TYPE_DOUBLE_DECK_LOWER]: lowerRate },
    baseRate
  );
}

/** Bed type for a slot, with legacy rooms treated as single beds. */
export function bedTypeOf(room, bedId) {
  const type = room?.bedTypes?.[bedId];
  return BED_TYPES.has(type) ? type : BED_TYPE_SINGLE;
}

export function bedTypeLabel(type) {
  switch (type) {
    case BED_TYPE_DOUBLE_DECK_UPPER:
      return "Double deck · upper";
    case BED_TYPE_DOUBLE_DECK_LOWER:
      return "Double deck · lower";
    default:
      return "Single bed space";
  }
}

export function bedTypeSymbol(type) {
  switch (type) {
    case BED_TYPE_DOUBLE_DECK_UPPER:
      return "U";
    case BED_TYPE_DOUBLE_DECK_LOWER:
      return "L";
    default:
      return "S";
  }
}

/** Groups consecutive upper/lower spaces as a bunk for the room-map visual. */
export function bedSpaceGroups(room, capacity) {
  const spaces = bedLabels(capacity).map((id, index) => ({
    id,
    number: index + 1,
    type: bedTypeOf(room, id),
  }));
  const groups = [];

  for (let index = 0; index < spaces.length;) {
    const first = spaces[index];
    const second = spaces[index + 1];
    const isBunkPair = second && (
      (first.type === BED_TYPE_DOUBLE_DECK_UPPER && second.type === BED_TYPE_DOUBLE_DECK_LOWER) ||
      (first.type === BED_TYPE_DOUBLE_DECK_LOWER && second.type === BED_TYPE_DOUBLE_DECK_UPPER)
    );

    if (isBunkPair) {
      groups.push({
        kind: "doubleDeck",
        spaces: first.type === BED_TYPE_DOUBLE_DECK_UPPER ? [first, second] : [second, first],
      });
      index += 2;
    } else {
      groups.push({ kind: first.type === BED_TYPE_SINGLE ? "single" : "unpaired", spaces: [first] });
      index += 1;
    }
  }

  return groups;
}

/** The monthly rate for one bed in a room. */
export function bedRateOf(room, bedId) {
  const own = Number(room?.bedRates?.[bedId]);
  if (own > 0) return own;
  const typeRate = Number(room?.bedTypeRates?.[bedTypeOf(room, bedId)]);
  return typeRate > 0 ? typeRate : Number(room?.monthlyRatePerBed) || 0;
}

/** Bed spaces whose effective rate differs from the room's rate. */
export function customBedRates(room) {
  const base = Number(room?.monthlyRatePerBed) || 0;
  return bedLabels(room?.capacity)
    .map((bed) => [bed, bedRateOf(room, bed)])
    .filter(([, rate]) => rate > 0 && rate !== base);
}

/** Bed spaces with a non-default type. */
export function customBedTypes(room) {
  return Object.entries(room?.bedTypes || {}).filter(([, type]) => BED_TYPES.has(type) && type !== BED_TYPE_SINGLE);
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
export function cleanBedRates(bedRates, capacity, baseRate, bedTypes = {}, bedTypeRates = {}) {
  const beds = new Set(bedLabels(capacity));
  const base = Number(baseRate) || 0;
  return Object.fromEntries(
    Object.entries(bedRates || {})
      .map(([bed, v]) => [bed, Math.round((Number(v) || 0) * 100) / 100])
      .filter(([bed, v]) => {
        const inheritedRate = Number(bedTypeRates[bedTypes[bed]]) || base;
        return beds.has(bed) && v > 0 && v !== inheritedRate;
      })
  );
}

/** Keeps only supported upper/lower defaults with valid rates differing from the room rate. */
export function cleanBedTypeRates(bedTypeRates, baseRate) {
  const base = Number(baseRate) || 0;
  return Object.fromEntries(
    [BED_TYPE_DOUBLE_DECK_UPPER, BED_TYPE_DOUBLE_DECK_LOWER]
      .map((type) => [type, Math.round((Number(bedTypeRates?.[type]) || 0) * 100) / 100])
      .filter(([, rate]) => rate > 0 && rate !== base)
  );
}

/** Keeps only real bed spaces with a supported non-default type. */
export function cleanBedTypes(bedTypes, capacity) {
  const beds = new Set(bedLabels(capacity));
  return Object.fromEntries(
    Object.entries(bedTypes || {}).filter(
      ([bed, type]) => beds.has(bed) && BED_TYPES.has(type) && type !== BED_TYPE_SINGLE
    )
  );
}

/** "₱3,000" or "₱3,000–₱3,500" for a room. */
export function rateRangeText(room) {
  const { min, max } = roomRateRange(room);
  const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;
  return min === max ? peso(min) : `${peso(min)}–${peso(max)}`;
}

/**
 * Puts a room's tenants on its beds: a tenant with a bed (bedId "Bed 3", or
 * just 3) sits there; the rest are returned as `unplaced`.
 */
export function placeTenants(capacity, roomTenants = []) {
  const byBed = new Map();
  const unplaced = [];
  roomTenants.forEach((tenant) => {
    const assigned = tenant.bedId || tenant.bedNumber || tenant.bed;
    const n = Number(String(assigned || "").match(/\d+/)?.[0]);
    if (n >= 1 && n <= capacity && !byBed.has(n)) byBed.set(n, tenant);
    else unplaced.push(tenant);
  });
  return { byBed, unplaced };
}

/**
 * The bed units of a room with who is in each space. With `fillUnplaced`,
 * tenants without a bed fill free spaces (so the map still shows how full a
 * room is); otherwise they're left out and returned in `unplaced`.
 */
export function roomBedUnits(room, capacity, roomTenants = [], { fillUnplaced = false } = {}) {
  const { byBed, unplaced } = placeTenants(capacity, roomTenants);
  const filler = fillUnplaced ? [...unplaced] : [];
  let bunkNo = 0;
  const units = bedSpaceGroups(room, capacity).map((group) => {
    if (group.kind === "doubleDeck") bunkNo += 1;
    return {
      ...group,
      bunkNo: group.kind === "doubleDeck" ? bunkNo : null,
      spaces: group.spaces.map((space) => ({ ...space, tenant: byBed.get(space.number) || null })),
    };
  });
  units.forEach((unit) => unit.spaces.forEach((space) => {
    if (!space.tenant && filler.length) space.tenant = filler.shift();
  }));
  return { units, unplaced: fillUnplaced ? filler : unplaced };
}

const isLoose = (group) => group && group.kind !== "doubleDeck";

/**
 * Which bed a single bed would share a double deck with: the next bed if it
 * is single, else the previous one. null when neither is free to pair. Bed
 * numbers never change, so tenants stay on their beds.
 */
export function bunkPartnerOf(room, capacity, bedId) {
  const groups = bedSpaceGroups(room, capacity);
  const i = groups.findIndex((group) => group.spaces.some((space) => space.id === bedId));
  if (i < 0 || !isLoose(groups[i])) return null;
  if (isLoose(groups[i + 1])) return { upper: bedId, lower: groups[i + 1].spaces[0].id };
  if (isLoose(groups[i - 1])) return { upper: groups[i - 1].spaces[0].id, lower: bedId };
  return null;
}

/**
 * Makes the bed unit holding `bedId` a single bed (a double deck splits into
 * two single beds) or a double deck (pairs with a neighbouring single bed).
 * Returns the new bedTypes, or null when the change isn't possible.
 */
export function setBedUnitKind(room, capacity, bedId, kind) {
  const types = { ...cleanBedTypes(room?.bedTypes, capacity) };
  const group = bedSpaceGroups(room, capacity).find((g) => g.spaces.some((space) => space.id === bedId));
  if (!group) return null;
  if (kind === "single") {
    group.spaces.forEach((space) => delete types[space.id]);
    return types;
  }
  if (group.kind === "doubleDeck") return types;
  const pair = bunkPartnerOf(room, capacity, bedId);
  if (!pair) return null;
  types[pair.upper] = BED_TYPE_DOUBLE_DECK_UPPER;
  types[pair.lower] = BED_TYPE_DOUBLE_DECK_LOWER;
  return types;
}

/** A, B ... Z, AA, AB ... for the n-th bed (0-based). */
export function bedLetter(index) {
  let n = Math.max(0, Math.floor(Number(index) || 0)) + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * What owners and tenants see for each bed space. Every bed (a single bed or
 * a whole double deck) gets a letter in order, and a double deck's spaces are
 * its upper and lower: { "Bed 1": "Bed A Upper", "Bed 2": "Bed A Lower",
 * "Bed 3": "Bed B" }. Saved bed ids ("Bed 1"...) never change.
 */
export function bedNameMap(room, capacity = room?.capacity) {
  const names = {};
  bedSpaceGroups(room, capacity).forEach((group, index) => {
    const letter = bedLetter(index);
    group.spaces.forEach((space) => {
      names[space.id] = space.type === BED_TYPE_DOUBLE_DECK_UPPER
        ? t("Bed {letter} Upper", { letter })
        : space.type === BED_TYPE_DOUBLE_DECK_LOWER
          ? t("Bed {letter} Lower", { letter })
          : t("Bed {letter}", { letter });
    });
  });
  return names;
}

/** The display name of one bed ("Bed A Upper"); falls back to the saved id. */
export function bedNameOf(room, bedId) {
  if (bedId === undefined || bedId === null || bedId === "" || bedId === "N/A") return "";
  const raw = String(bedId).trim();
  const id = /^\d+$/.test(raw) ? bedLabel(raw) : raw;
  const capacity = Number(room?.capacity) || 0;
  return (capacity > 0 && bedNameMap(room, capacity)[id]) || id;
}

/**
 * Double decks per room for a room group from the property setup:
 * `bunksPerRoom` (0 = all single beds), or the older all-or-nothing
 * `bedLayout` ("doubleDeck" = as many as fit). Never more than fit.
 */
export function bunksPerRoomOf(group, capacity = group?.capacityPerRoom) {
  const max = Math.floor((Number(capacity) || 0) / 2);
  const asked = group?.bunksPerRoom !== undefined && group?.bunksPerRoom !== ""
    ? Number(group.bunksPerRoom) || 0
    : group?.bedLayout === BED_LAYOUT_DOUBLE_DECK ? max : 0;
  return Math.min(Math.max(0, Math.floor(asked)), max);
}

/** bedTypes + bedTypeRates for one new room of a group (only what's needed). */
export function groupBedSetup(group, capacity, baseRate) {
  const bunks = bunksPerRoomOf(group, capacity);
  if (!bunks) return {};
  const bedTypes = bedTypesForBunks(capacity, bunks);
  const bedTypeRates = cleanBedTypeRates(
    { [BED_TYPE_DOUBLE_DECK_UPPER]: group?.upperRate, [BED_TYPE_DOUBLE_DECK_LOWER]: group?.lowerRate },
    baseRate
  );
  return { bedTypes, ...(Object.keys(bedTypeRates).length ? { bedTypeRates } : {}) };
}

/**
 * Every rate a room charges, for showing owners: one line per kind of bed
 * (single / upper / lower) at its rate, plus one line per bed with a rate of
 * its own. [{ key, kind: "single"|"upper"|"lower"|"own", bed?, rate, count }]
 */
export function roomRateLines(room, capacity = room?.capacity) {
  const lines = new Map();
  bedLabels(capacity).forEach((bed) => {
    const own = Number(room?.bedRates?.[bed]) > 0;
    const type = bedTypeOf(room, bed);
    const kind = own ? "own" : type === BED_TYPE_DOUBLE_DECK_UPPER ? "upper" : type === BED_TYPE_DOUBLE_DECK_LOWER ? "lower" : "single";
    const key = own ? bed : kind;
    const line = lines.get(key) || { key, kind, bed: own ? bed : undefined, rate: bedRateOf(room, bed), count: 0 };
    line.count += 1;
    lines.set(key, line);
  });
  const order = { single: 0, upper: 1, lower: 2, own: 3 };
  const bedNo = (line) => Number(String(line.bed || "").match(/\d+/)?.[0]) || 0;
  return [...lines.values()].sort((a, b) => order[a.kind] - order[b.kind] || bedNo(a) - bedNo(b));
}
