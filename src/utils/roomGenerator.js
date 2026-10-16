// src/utils/roomGenerator.js
//
// Pure functions for turning the owner's Step 3 choices into an actual
// array of room objects. Kept separate from the component so the logic
// is easy to unit-test and reuse (e.g. on the Success screen).

/**
 * Generates a room name based on the selected naming pattern.
 * @param {'floor'|'alpha'|'sequential'} pattern
 * @param {number} floorNumber - 1-indexed
 * @param {number} roomIndexOnFloor - 1-indexed, resets every floor
 * @param {number} globalRoomIndex - 1-indexed, counts across the whole building
 */
export function generateRoomName(
  pattern,
  floorNumber,
  roomIndexOnFloor,
  globalRoomIndex,
) {
  switch (pattern) {
    case "floor":
      // 101, 102... / 201, 202...
      return `${floorNumber}${String(roomIndexOnFloor).padStart(2, "0")}`;
    case "alpha": {
      // A1, A2... B1, B2...
      const letter = String.fromCharCode(64 + floorNumber); // 1 -> A, 2 -> B
      return `${letter}${roomIndexOnFloor}`;
    }
    case "sequential":
      // 1, 2, 3...
      return `${globalRoomIndex}`;
    default:
      return `${floorNumber}${String(roomIndexOnFloor).padStart(2, "0")}`;
  }
}

/**
 * "Uniform Layout" mode: every floor gets the same room count/capacity/rate.
 */
export function buildUniformRooms({
  totalFloors,
  roomsPerFloor,
  capacityPerRoom,
  monthlyRate,
  namingPattern,
}) {
  const rooms = [];
  let globalIndex = 1;

  for (let floor = 1; floor <= totalFloors; floor++) {
    for (let i = 1; i <= roomsPerFloor; i++) {
      rooms.push({
        roomName: generateRoomName(namingPattern, floor, i, globalIndex),
        floor,
        capacity: capacityPerRoom,
        monthlyRatePerBed: monthlyRate,
        occupiedBeds: 0,
      });
      globalIndex++;
    }
  }
  return rooms;
}

/**
 * "Configure per Floor" mode: each floor has its own room count/capacity/rate.
 * @param {Array<{floorNumber:number, numberOfRooms:number, capacityPerRoom:number, monthlyRate:number}>} floorConfigs
 */
export function buildPerFloorRooms({ floorConfigs, namingPattern }) {
  const rooms = [];
  let globalIndex = 1;

  floorConfigs.forEach((floorConfig, floorIndex) => {
    const floorNumber = Number(floorConfig.floorNumber) || floorIndex + 1;
    const roomGroups = Array.isArray(floorConfig.roomGroups)
      ? floorConfig.roomGroups
      : [floorConfig];
    let roomIndexOnFloor = 1;

    roomGroups.forEach((group) => {
      const numberOfRooms = Math.max(0, Number(group.numberOfRooms) || 0);
      const capacityPerRoom = Math.max(0, Number(group.capacityPerRoom) || 0);
      const monthlyRate = Math.max(0, Number(group.monthlyRate) || 0);

      for (let i = 0; i < numberOfRooms; i++) {
        rooms.push({
          roomName: generateRoomName(
            namingPattern,
            floorNumber,
            roomIndexOnFloor,
            globalIndex,
          ),
          floor: floorNumber,
          capacity: capacityPerRoom,
          monthlyRatePerBed: monthlyRate,
          roomType: group.roomType || "Bedspace",
          occupiedBeds: 0,
        });
        roomIndexOnFloor++;
        globalIndex++;
      }
    });
  });

  return rooms;
}

/**
 * Totals + per-floor breakdown, used by both the live preview card
 * and the final Success screen metrics.
 */
export function computeSummary(rooms) {
  const totalRooms = rooms.length;
  const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);

  const perFloorBreakdown = rooms.reduce((acc, r) => {
    if (!acc[r.floor]) {
      acc[r.floor] = { rooms: 0, beds: 0, rate: r.monthlyRatePerBed, roomTypes: {} };
    }
    acc[r.floor].rooms += 1;
    acc[r.floor].beds += r.capacity;
    const roomType = r.roomType || "Bedspace";
    if (!acc[r.floor].roomTypes[roomType]) {
      acc[r.floor].roomTypes[roomType] = { rooms: 0, beds: 0 };
    }
    acc[r.floor].roomTypes[roomType].rooms += 1;
    acc[r.floor].roomTypes[roomType].beds += r.capacity;
    return acc;
  }, {});

  return { totalRooms, totalBeds, perFloorBreakdown };
}
