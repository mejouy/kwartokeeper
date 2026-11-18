import { describe, expect, it } from "vitest";
import { BED_LAYOUT_DOUBLE_DECK, bedRateOf, bunksPerRoomOf } from "./bedRates";
import { buildPerFloorRooms, buildUniformRooms } from "./roomGenerator";

describe("room bed layouts", () => {
  it("applies the selected layout to uniform rooms", () => {
    const [room] = buildUniformRooms({
      totalFloors: 1,
      roomsPerFloor: 1,
      capacityPerRoom: 2,
      monthlyRate: 2500,
      namingPattern: "floor",
      bedLayout: BED_LAYOUT_DOUBLE_DECK,
    });

    expect(room.bedTypes).toEqual({
      "Bed 1": "doubleDeckUpper",
      "Bed 2": "doubleDeckLower",
    });
  });

  it("carries upper/lower bunk rates and makes an odd last bed a single bed", () => {
    const [room] = buildUniformRooms({
      totalFloors: 1,
      roomsPerFloor: 1,
      capacityPerRoom: 3,
      monthlyRate: 2500,
      namingPattern: "floor",
      bedLayout: BED_LAYOUT_DOUBLE_DECK,
      upperRate: 2300,
      lowerRate: 2800,
    });

    expect(room.bedTypes).toEqual({ "Bed 1": "doubleDeckUpper", "Bed 2": "doubleDeckLower" });
    expect(room.bedTypeRates).toEqual({ doubleDeckUpper: 2300, doubleDeckLower: 2800 });
    expect([1, 2, 3].map((n) => bedRateOf(room, `Bed ${n}`))).toEqual([2300, 2800, 2500]);
  });

  it("builds a mix of double decks and single beds per room", () => {
    const [room] = buildPerFloorRooms({
      namingPattern: "floor",
      floorConfigs: [{ floorNumber: 1, roomGroups: [{ numberOfRooms: 1, capacityPerRoom: 5, monthlyRate: 2500, bunksPerRoom: 1, upperRate: 2200 }] }],
    });
    expect(room.bedTypes).toEqual({ "Bed 1": "doubleDeckUpper", "Bed 2": "doubleDeckLower" });
    expect(room.bedTypeRates).toEqual({ doubleDeckUpper: 2200 });
    expect([1, 2, 3, 4, 5].map((n) => bedRateOf(room, `Bed ${n}`))).toEqual([2200, 2500, 2500, 2500, 2500]);
  });

  it("never asks for more double decks than fit, and reads the old all-double-deck layout", () => {
    expect(bunksPerRoomOf({ capacityPerRoom: 3, bunksPerRoom: 4 })).toBe(1);
    expect(bunksPerRoomOf({ capacityPerRoom: 6, bedLayout: "doubleDeck" })).toBe(3);
    expect(bunksPerRoomOf({ capacityPerRoom: 6 })).toBe(0);
  });

  it("skips bunk rates for single-bed layouts", () => {
    const [room] = buildPerFloorRooms({
      namingPattern: "floor",
      floorConfigs: [{ floorNumber: 1, roomGroups: [{ numberOfRooms: 1, capacityPerRoom: 2, monthlyRate: 2500, upperRate: 2000 }] }],
    });
    expect(room.bedTypes).toBeUndefined();
    expect(room.bedTypeRates).toBeUndefined();
  });

  it("applies each mixed room group's bed layout", () => {
    const [room] = buildPerFloorRooms({
      namingPattern: "floor",
      floorConfigs: [{
        floorNumber: 1,
        roomGroups: [{
          numberOfRooms: 1,
          capacityPerRoom: 2,
          monthlyRate: 2500,
          roomType: "Bedspace",
          bedLayout: BED_LAYOUT_DOUBLE_DECK,
        }],
      }],
    });

    expect(room.bedTypes).toEqual({
      "Bed 1": "doubleDeckUpper",
      "Bed 2": "doubleDeckLower",
    });
  });
});
