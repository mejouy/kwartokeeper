import { describe, expect, it } from "vitest";
import {
  BED_LAYOUT_DOUBLE_DECK,
  BED_TYPE_DOUBLE_DECK_LOWER,
  BED_TYPE_DOUBLE_DECK_UPPER,
  BED_TYPE_SINGLE,
  bedRateOf,
  bedTypeOf,
  bedSpaceGroups,
  cleanBedRates,
  cleanBedTypeRates,
  cleanBedTypes,
  bedLetter,
  bedNameOf,
  bedNameMap,
  bedTypesForBunks,
  bunkCountOf,
  bunkPartnerOf,
  setBedUnitKind,
  defaultBedTypes,
  roomBedUnits,
  roomRateLines,
} from "./bedRates";

describe("bed-space types", () => {
  it("creates alternating upper and lower spaces for double-deck layouts", () => {
    expect(defaultBedTypes(4, BED_LAYOUT_DOUBLE_DECK)).toEqual({
      "Bed 1": BED_TYPE_DOUBLE_DECK_UPPER,
      "Bed 2": BED_TYPE_DOUBLE_DECK_LOWER,
      "Bed 3": BED_TYPE_DOUBLE_DECK_UPPER,
      "Bed 4": BED_TYPE_DOUBLE_DECK_LOWER,
    });
    expect(defaultBedTypes(2)).toEqual({});
  });

  it("defaults legacy and invalid space types to single beds", () => {
    expect(bedTypeOf({}, "Bed 1")).toBe(BED_TYPE_SINGLE);
    expect(bedTypeOf({ bedTypes: { "Bed 1": "unknown" } }, "Bed 1")).toBe(BED_TYPE_SINGLE);
  });

  it("keeps only valid configured spaces within room capacity", () => {
    expect(cleanBedTypes({
      "Bed 1": BED_TYPE_DOUBLE_DECK_UPPER,
      "Bed 2": BED_TYPE_SINGLE,
      "Bed 3": BED_TYPE_DOUBLE_DECK_LOWER,
      "Bed 4": "unknown",
    }, 2)).toEqual({
      "Bed 1": BED_TYPE_DOUBLE_DECK_UPPER,
    });
  });

  it("groups adjacent upper and lower spaces into a bunk for the map", () => {
    expect(bedSpaceGroups({ bedTypes: defaultBedTypes(4, BED_LAYOUT_DOUBLE_DECK) }, 4)).toEqual([
      { kind: "doubleDeck", spaces: [{ id: "Bed 1", number: 1, type: BED_TYPE_DOUBLE_DECK_UPPER }, { id: "Bed 2", number: 2, type: BED_TYPE_DOUBLE_DECK_LOWER }] },
      { kind: "doubleDeck", spaces: [{ id: "Bed 3", number: 3, type: BED_TYPE_DOUBLE_DECK_UPPER }, { id: "Bed 4", number: 4, type: BED_TYPE_DOUBLE_DECK_LOWER }] },
    ]);
    expect(bedSpaceGroups({}, 2).map((group) => group.kind)).toEqual(["single", "single"]);
  });

  it("allows upper and lower spaces to have different monthly rates", () => {
    const room = {
      monthlyRatePerBed: 2500,
      bedTypes: {
        "Bed 1": BED_TYPE_DOUBLE_DECK_UPPER,
        "Bed 2": BED_TYPE_DOUBLE_DECK_LOWER,
      },
      bedRates: {
        "Bed 1": 2800,
        "Bed 2": 2300,
      },
    };

    expect(bedRateOf(room, "Bed 1")).toBe(2800);
    expect(bedRateOf(room, "Bed 2")).toBe(2300);
  });

  it("uses shared upper/lower rates while allowing an individual space override", () => {
    const room = {
      capacity: 4,
      monthlyRatePerBed: 2500,
      bedTypes: defaultBedTypes(4, BED_LAYOUT_DOUBLE_DECK),
      bedTypeRates: {
        doubleDeckUpper: 2800,
        doubleDeckLower: 2300,
      },
      bedRates: {
        "Bed 1": 3000,
      },
    };

    expect(bedRateOf(room, "Bed 1")).toBe(3000);
    expect(bedRateOf(room, "Bed 3")).toBe(2800);
    expect(bedRateOf(room, "Bed 2")).toBe(2300);
    expect(bedRateOf(room, "Bed 4")).toBe(2300);
    expect(cleanBedRates({
      "Bed 1": 2800,
      "Bed 2": 2600,
    }, 4, 2500, room.bedTypes, room.bedTypeRates)).toEqual({
      "Bed 2": 2600,
    });
  });

  it("cleans redundant, unsupported, and invalid bunk rates", () => {
    expect(cleanBedTypeRates({
      doubleDeckUpper: 2500,
      doubleDeckLower: 2199.999,
      single: 1800,
      unknown: 1700,
    }, 2500)).toEqual({
      doubleDeckLower: 2200,
    });
  });
});

describe("bunk layout and tenant placement", () => {
  it("pairs the first beds as bunks and leaves the rest single", () => {
    expect(bedTypesForBunks(5, 1)).toEqual({ "Bed 1": BED_TYPE_DOUBLE_DECK_UPPER, "Bed 2": BED_TYPE_DOUBLE_DECK_LOWER });
    expect(bedTypesForBunks(3, 5)).toEqual({ "Bed 1": BED_TYPE_DOUBLE_DECK_UPPER, "Bed 2": BED_TYPE_DOUBLE_DECK_LOWER });
    expect(bedTypesForBunks(4, 0)).toEqual({});
    expect(bunkCountOf({ capacity: 6, bedTypes: bedTypesForBunks(6, 2) })).toBe(2);
    expect(defaultBedTypes(3, BED_LAYOUT_DOUBLE_DECK)).toEqual(bedTypesForBunks(3, 1));
  });

  it("puts tenants on their own bed and keeps the rest unplaced", () => {
    const room = { capacity: 3, bedTypes: bedTypesForBunks(3, 1) };
    const { units, unplaced } = roomBedUnits(room, 3, [{ id: "a", bedId: "Bed 2" }, { id: "b" }]);
    expect(units.map((u) => [u.kind, u.bunkNo])).toEqual([["doubleDeck", 1], ["single", null]]);
    expect(units[0].spaces.map((s) => s.tenant?.id || null)).toEqual([null, "a"]);
    expect(unplaced.map((t) => t.id)).toEqual(["b"]);
  });

  it("fills free spaces with tenants who have no bed when asked", () => {
    const { units, unplaced } = roomBedUnits({}, 2, [{ id: "a", bedId: "Bed 2" }, { id: "b" }], { fillUnplaced: true });
    expect(units.flatMap((u) => u.spaces.map((s) => s.tenant?.id))).toEqual(["b", "a"]);
    expect(unplaced).toEqual([]);
  });
});

describe("switching one bed between single and double deck", () => {
  it("pairs a single bed with the next single bed, or the previous one", () => {
    const room = { bedTypes: {} };
    expect(setBedUnitKind(room, 4, "Bed 3", "doubleDeck")).toEqual({ "Bed 3": BED_TYPE_DOUBLE_DECK_UPPER, "Bed 4": BED_TYPE_DOUBLE_DECK_LOWER });
    expect(setBedUnitKind(room, 4, "Bed 4", "doubleDeck")).toEqual({ "Bed 3": BED_TYPE_DOUBLE_DECK_UPPER, "Bed 4": BED_TYPE_DOUBLE_DECK_LOWER });
  });

  it("splits a double deck back into two single beds", () => {
    const room = { bedTypes: bedTypesForBunks(4, 2) };
    expect(setBedUnitKind(room, 4, "Bed 2", "single")).toEqual({ "Bed 3": BED_TYPE_DOUBLE_DECK_UPPER, "Bed 4": BED_TYPE_DOUBLE_DECK_LOWER });
  });

  it("can't pair a single bed with no single neighbour", () => {
    const room = { bedTypes: bedTypesForBunks(3, 1) }; // bunk(1,2) + single 3
    expect(bunkPartnerOf(room, 3, "Bed 3")).toBeNull();
    expect(setBedUnitKind(room, 3, "Bed 3", "doubleDeck")).toBeNull();
  });
});

describe("bed names", () => {
  it("letters each bed and names a double deck's upper and lower", () => {
    const room = { capacity: 5, bedTypes: bedTypesForBunks(5, 2) };
    expect(bedNameMap(room)).toEqual({
      "Bed 1": "Bed A Upper", "Bed 2": "Bed A Lower",
      "Bed 3": "Bed B Upper", "Bed 4": "Bed B Lower",
      "Bed 5": "Bed C",
    });
    expect(bedNameOf(room, "Bed 4")).toBe("Bed B Lower");
    expect(bedNameOf(room, 5)).toBe("Bed C");
  });

  it("falls back to the saved id when the room is unknown", () => {
    expect(bedNameOf(null, "Bed 2")).toBe("Bed 2");
    expect(bedNameOf(null, "3")).toBe("Bed 3");
    expect(bedNameOf({}, "")).toBe("");
  });

  it("keeps lettering past Z", () => {
    expect([0, 25, 26, 27].map(bedLetter)).toEqual(["A", "Z", "AA", "AB"]);
  });
});

describe("room rate lines", () => {
  it("lists each kind of bed at its rate, then beds with their own rate", () => {
    const room = { capacity: 5, monthlyRatePerBed: 2500, bedTypes: bedTypesForBunks(5, 2), bedTypeRates: { doubleDeckUpper: 2300, doubleDeckLower: 2800 }, bedRates: { "Bed 3": 2000 } };
    expect(roomRateLines(room).map(({ kind, bed, rate, count }) => [kind, bed, rate, count])).toEqual([
      ["single", undefined, 2500, 1],
      ["upper", undefined, 2300, 1],
      ["lower", undefined, 2800, 2],
      ["own", "Bed 3", 2000, 1],
    ]);
  });
});
