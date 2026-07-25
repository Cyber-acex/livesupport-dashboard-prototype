import { saveDeliveryRoute, saveDeliveryEta, saveDeliveryDistance } from '../services/deliveryTrackingService.js';

const DELIVERY_BRANCH_ROOM = (branchId) => `branch:${branchId}`;
const DELIVERY_ORDER_ROOM = (orderId) => `order:${orderId}`;
const DELIVERY_RIDER_ROOM = (riderId) => `rider:${riderId}`;
const DELIVERY_CUSTOMER_ROOM = (customerId) => `customer:${customerId}`;
const DELIVERY_MANAGER_ROOM = (branchId) => `manager:${branchId}`;

function broadcastDeliveryEvent(io, event, payload, branchId, orderId, riderId, customerId) {
  const rooms = new Set();
  if (branchId) rooms.add(DELIVERY_BRANCH_ROOM(branchId));
  if (orderId) rooms.add(DELIVERY_ORDER_ROOM(orderId));
  if (riderId) rooms.add(DELIVERY_RIDER_ROOM(riderId));
  if (customerId) rooms.add(DELIVERY_CUSTOMER_ROOM(customerId));
  if (branchId) rooms.add(DELIVERY_MANAGER_ROOM(branchId));
  rooms.forEach((room) => {
    io.to(room).emit(event, payload);
  });
}

function joinDeliveryRooms(socket, { branchId, orderId, riderId, customerId, role }) {
  if (branchId) socket.join(DELIVERY_BRANCH_ROOM(branchId));
  if (orderId) socket.join(DELIVERY_ORDER_ROOM(orderId));
  if (riderId) socket.join(DELIVERY_RIDER_ROOM(riderId));
  if (customerId) socket.join(DELIVERY_CUSTOMER_ROOM(customerId));
  if (role === 'manager' && branchId) socket.join(DELIVERY_MANAGER_ROOM(branchId));
}

function leaveDeliveryRooms(socket) {
  const rooms = Array.from(socket.rooms);
  rooms.forEach((room) => {
    if (room.startsWith('branch:') || room.startsWith('order:') || room.startsWith('rider:') || room.startsWith('customer:') || room.startsWith('manager:')) {
      socket.leave(room);
    }
  });
}

async function publishDeliveryUpdates(io, deliveryId, payload) {
  if (!payload) return;
  const { branchId, orderId, riderId, customerId, eta, distance, route } = payload;
  broadcastDeliveryEvent(io, 'delivery:eta:update', { deliveryId, eta, distance }, branchId, orderId, riderId, customerId);
  broadcastDeliveryEvent(io, 'delivery:distance:update', { deliveryId, distance }, branchId, orderId, riderId, customerId);
  broadcastDeliveryEvent(io, 'delivery:route:update', { deliveryId, route }, branchId, orderId, riderId, customerId);
  if (eta) await saveDeliveryEta(deliveryId, eta);
  if (distance != null) await saveDeliveryDistance(deliveryId, distance);
  if (route) await saveDeliveryRoute(deliveryId, route);
}

export { joinDeliveryRooms, leaveDeliveryRooms, broadcastDeliveryEvent, publishDeliveryUpdates };
