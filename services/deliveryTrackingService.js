import { getJson, setJson, del, isReady } from './redisClient.js';
import { calculateRoute, calcEta } from './osrmService.js';
import { db } from '../db/database.js';

const RIDER_LOCATION_KEY = (deliveryId) => `delivery:riderLocation:${deliveryId}`;
const DELIVERY_ROUTE_KEY = (deliveryId) => `delivery:route:${deliveryId}`;
const DELIVERY_ETA_KEY = (deliveryId) => `delivery:eta:${deliveryId}`;
const DELIVERY_DISTANCE_KEY = (deliveryId) => `delivery:distance:${deliveryId}`;
const DELIVERY_CACHE_TTL = Number(process.env.DELIVERY_CACHE_TTL_SECONDS || '300');

async function saveRiderLocation(deliveryId, location) {
  if (!isReady()) return null;
  return setJson(RIDER_LOCATION_KEY(deliveryId), location, { EX: DELIVERY_CACHE_TTL });
}

async function getRiderLocation(deliveryId) {
  if (!isReady()) return null;
  return getJson(RIDER_LOCATION_KEY(deliveryId));
}

async function saveDeliveryRoute(deliveryId, route) {
  if (!isReady()) return null;
  return setJson(DELIVERY_ROUTE_KEY(deliveryId), route, { EX: DELIVERY_CACHE_TTL });
}

async function getDeliveryRoute(deliveryId) {
  if (!isReady()) return null;
  return getJson(DELIVERY_ROUTE_KEY(deliveryId));
}

async function saveDeliveryEta(deliveryId, eta) {
  if (!isReady()) return null;
  return setJson(DELIVERY_ETA_KEY(deliveryId), { eta }, { EX: DELIVERY_CACHE_TTL });
}

async function getDeliveryEta(deliveryId) {
  if (!isReady()) return null;
  const data = await getJson(DELIVERY_ETA_KEY(deliveryId));
  return data?.eta || null;
}

async function saveDeliveryDistance(deliveryId, distance) {
  if (!isReady()) return null;
  return setJson(DELIVERY_DISTANCE_KEY(deliveryId), { distance }, { EX: DELIVERY_CACHE_TTL });
}

async function getDeliveryDistance(deliveryId) {
  if (!isReady()) return null;
  const data = await getJson(DELIVERY_DISTANCE_KEY(deliveryId));
  return data?.distance || null;
}

async function clearDeliveryCache(deliveryId) {
  if (!isReady()) return null;
  await del(RIDER_LOCATION_KEY(deliveryId));
  await del(DELIVERY_ROUTE_KEY(deliveryId));
  await del(DELIVERY_ETA_KEY(deliveryId));
  await del(DELIVERY_DISTANCE_KEY(deliveryId));
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
