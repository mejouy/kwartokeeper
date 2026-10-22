// A room the owner marked as under maintenance (from the property page).
// Nobody can be newly assigned to it until it is set back to available.
export const isRoomUnderMaintenance = (room) =>
  String(room?.status || "").toLowerCase() === "maintenance" || Boolean(room?.underMaintenance);

export const MAINTENANCE_ROOM_MESSAGE = "This room is under maintenance. Choose another room.";
