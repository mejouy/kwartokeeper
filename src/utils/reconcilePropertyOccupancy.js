import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";

const isActiveTenant = (tenant) => {
  const status = String(tenant?.status || "active").trim().toLowerCase();
  return status !== "inactive" && status !== "archived" && status !== "deactivated";
};

const normalizeRoomId = (roomId) => String(roomId || "").trim();

export const getActiveTenantAssignments = async (propertyId) => {
  const tenantSources = await Promise.all([
    getDocs(query(collection(db, "tenants"), where("propertyId", "==", propertyId))),
    getDocs(query(collection(db, "users"), where("propertyId", "==", propertyId))),
  ]);

  const uniqueTenants = new Map();
  tenantSources.forEach((snapshot) => {
    snapshot.docs.forEach((tenantDoc) => {
      const tenant = { id: tenantDoc.id, ...tenantDoc.data() };
      const tenantId = tenant.uid || tenant.id;
      if (!tenantId) return;

      const current = uniqueTenants.get(tenantId);
      uniqueTenants.set(tenantId, { ...current, ...tenant });
    });
  });

  return [...uniqueTenants.values()].filter((tenant) => {
    return tenant.role === "tenant" && isActiveTenant(tenant) && tenant.propertyId;
  });
};

export const getPropertyRoomOccupancy = async (propertyId) => {
  const propertySnapshot = await getDoc(doc(db, "properties", propertyId));
  if (!propertySnapshot.exists()) return [];

  const propertyData = propertySnapshot.data();
  const rooms = Array.isArray(propertyData.rooms) ? propertyData.rooms : [];
  const assignments = await getActiveTenantAssignments(propertyId);
  const roomOccupancy = new Map();

  assignments.forEach((tenant) => {
    const roomId = String(tenant.roomId || tenant.roomNumber || tenant.room || "").trim();
    if (!roomId) return;
    roomOccupancy.set(roomId, (roomOccupancy.get(roomId) || 0) + 1);
  });

  return rooms.map((room) => ({
    ...room,
    occupiedBeds: roomOccupancy.get(String(room.roomName || room.roomNumber || room.id || "").trim()) || 0,
  }));
};

export async function reconcilePropertyOccupancy(propertyId) {
  if (!propertyId) return;

  const propertyRef = doc(db, "properties", propertyId);
  const propertySnapshot = await getDoc(propertyRef);
  if (!propertySnapshot.exists()) return;

  const propertyData = propertySnapshot.data();
  const rooms = Array.isArray(propertyData.rooms) ? propertyData.rooms : [];
  const assignments = await getActiveTenantAssignments(propertyId);

  const roomOccupancy = new Map();
  assignments.forEach((tenant) => {
    const roomId = normalizeRoomId(tenant.roomId || tenant.roomNumber || tenant.room);
    if (!roomId) return;
    roomOccupancy.set(roomId, (roomOccupancy.get(roomId) || 0) + 1);
  });

  const updatedRooms = rooms.map((room) => {
    const roomId = normalizeRoomId(room.roomName || room.roomNumber || room.id);
    const occupiedBeds = roomOccupancy.get(roomId) || 0;
    return {
      ...room,
      occupiedBeds,
    };
  });

  const totalBeds = updatedRooms.reduce(
    (total, room) => total + Number(room.capacity || room.totalBeds || 0),
    0,
  );

  await updateDoc(propertyRef, {
    rooms: updatedRooms,
    totalBeds,
    occupiedBeds: assignments.length,
    updatedAt: new Date(),
  });
}
