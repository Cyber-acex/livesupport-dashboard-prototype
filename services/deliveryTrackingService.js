import { calculateRoute, calcEta } from './osrmService.js';
import { db } from '../db/database.js';

const DELIVERY_CACHE_TTL_MS = Number(process.env.DELIVERY_CACHE_TTL_SECONDS || '300') * 1000;
const deliveryRuntimeState = new Map();

function getRuntimeState(deliveryId) {
  const entry = deliveryRuntimeState.get(deliveryId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > DELIVERY_CACHE_TTL_MS) {
    deliveryRuntimeState.delete(deliveryId);
    return null;
  }
  return entry;
}

function setRuntimeState(deliveryId, patch) {
  const existing = getRuntimeState(deliveryId) || {};
  const next = { ...existing, ...patch, updatedAt: Date.now() };
  deliveryRuntimeState.set(deliveryId, next);
  return next;
}

async function saveRiderLocation(deliveryId, location) {
  const normalized = normalizeLocation(location);
  if (!normalized) return null;
  setRuntimeState(deliveryId, { riderLocation: normalized });
  return normalized;
}

async function getRiderLocation(deliveryId) {
  return getRuntimeState(deliveryId)?.riderLocation || null;
}

async function saveDeliveryRoute(deliveryId, route) {
  if (!route) return null;
  setRuntimeState(deliveryId, { route });
  return route;
}

async function getDeliveryRoute(deliveryId) {
  return getRuntimeState(deliveryId)?.route || null;
}

async function saveDeliveryEta(deliveryId, eta) {
  if (!eta) return null;
  setRuntimeState(deliveryId, { eta });
  return eta;
}

async function getDeliveryEta(deliveryId) {
  return getRuntimeState(deliveryId)?.eta || null;
}

async function saveDeliveryDistance(deliveryId, distance) {
  if (distance == null) return null;
  setRuntimeState(deliveryId, { distance });
  return distance;
}

async function getDeliveryDistance(deliveryId) {
  const entry = getRuntimeState(deliveryId);
  return entry?.distance != null ? entry.distance : null;
}

async function clearDeliveryCache(deliveryId) {
  deliveryRuntimeState.delete(deliveryId);
}

function normalizeLocation(location) {
  if (!location) return null;
  if (Array.isArray(location) && location.length >= 2) {
    return [Number(location[0]), Number(location[1])];
  }
  if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
    return [location.latitude, location.longitude];
  }
  if (typeof location.lat === 'number' && typeof location.lng === 'number') {
    return [location.lat, location.lng];
  }
  return null;
}

function getDeliveryPoints(delivery) {
  const restaurant = normalizeLocation(delivery.restaurantLocation) || normalizeLocation({ latitude: delivery.restaurant_lat, longitude: delivery.restaurant_lng });
  const customer = normalizeLocation(delivery.customerLocation) || normalizeLocation({ latitude: delivery.customer_lat, longitude: delivery.customer_lng });
  return { restaurant, customer };
}

async function updateDeliveryRouteAndEta(deliveryId, riderLocation, delivery) {
  const normalizedRider = normalizeLocation(riderLocation);
  if (!normalizedRider || !delivery) return null;

  const points = [];
  const pointsData = getDeliveryPoints(delivery);
  if (pointsData.restaurant) {
    points.push(pointsData.restaurant);
  }
  points.push(normalizedRider);
  if (pointsData.customer) {
    points.push(pointsData.customer);
  }

  if (points.length < 2) return null;

  const route = await calculateRoute(points);
  if (!route) return null;

  const eta = calcEta(route.duration);
  await saveDeliveryRoute(deliveryId, route);
  await saveDeliveryEta(deliveryId, eta);
  await saveDeliveryDistance(deliveryId, route.distance);

  return {
    route,
    eta,
    distance: route.distance,
  };
}

async function validateDeliveryUpdate(deliveryId, userId, role, latitude, longitude) {
  const sql = 'SELECT d.id, d.order_id, d.delivery_status, d.current_lat, d.current_lng, d.customer_lat, d.customer_lng, o.branch_id, o.customer_name, o.phone FROM deliveries d JOIN orders o ON o.id = d.order_id WHERE d.id = ? LIMIT 1';
  return new Promise((resolve, reject) => {
    db.query(sql, [deliveryId], (err, rows) => {
      if (err) return reject(err);
      if (!rows || rows.length === 0) return resolve({ valid: false, reason: 'delivery_not_found' });
      const record = rows[0];
      if (['Cancelled', 'Delivered'].includes(String(record.delivery_status || ''))) {
        return resolve({ valid: false, reason: 'delivery_not_active' });
      }
      if (role === 'rider') {
        const riderSql = 'SELECT id, role, branch_id FROM staffs WHERE id = ? AND role = ? LIMIT 1';
        db.query(riderSql, [userId, 'rider'], (rErr, rRows) => {
          if (rErr) return reject(rErr);
          if (!rRows || rRows.length === 0) return resolve({ valid: false, reason: 'invalid_rider' });
          const rider = rRows[0];
          if (Number(rider.branch_id) !== Number(record.branch_id)) {
            return resolve({ valid: false, reason: 'branch_mismatch' });
          }
          return resolve({ valid: true, delivery: record });
        });
        return;
      }
      return resolve({ valid: true, delivery: record });
    });
  });
}

export {
  saveRiderLocation,
  getRiderLocation,
  saveDeliveryRoute,
  getDeliveryRoute,
  saveDeliveryEta,
  getDeliveryEta,
  saveDeliveryDistance,
  getDeliveryDistance,
  clearDeliveryCache,
  updateDeliveryRouteAndEta,
  validateDeliveryUpdate,
};
