import fetch from 'node-fetch';

const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';
const ROUTE_CACHE_TTL_MS = Number(process.env.OSRM_ROUTE_CACHE_TTL_SECONDS || '300') * 1000;
const routeCache = new Map();

function buildRouteCacheKey(points) {
  const normalizedPoints = Array.isArray(points) ? points : [];
  return normalizedPoints.map((point) => `${Number(point[0])},${Number(point[1])}`).join(':');
}

function normalizeWaypoint(point) {
  return [Number(point[0]), Number(point[1])];
}

async function fetchOsrmRoute(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('OSRM requires at least two waypoint coordinates');
  }

  const coordinates = points
    .map((point) => `${Number(point[1])},${Number(point[0])}`)
    .join(';');

  const url = `${OSRM_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&annotations=duration,distance`;
  const response = await fetch(url, { timeout: 10000 });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OSRM request failed ${response.status} ${response.statusText} ${body}`);
  }

  const body = await response.json();
  if (!body || body.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) {
    throw new Error(`OSRM returned invalid route response: ${body?.code || 'unknown'}`);
  }

  const route = body.routes[0];
  return {
    distance: route.distance || 0,
    duration: route.duration || 0,
    geometry: route.geometry || null,
    legs: route.legs || [],
    waypoints: Array.isArray(body.waypoints)
      ? body.waypoints.map((wp) => ({
          name: wp.name || '',
          location: normalizeWaypoint(wp.location || [0, 0])
        }))
      : []
  };
}

function getCachedRoute(points) {
  const key = buildRouteCacheKey(points);
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ROUTE_CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return entry.route;
}

function cacheRoute(points, route) {
  const key = buildRouteCacheKey(points);
  routeCache.set(key, { route, cachedAt: Date.now() });
}

async function calculateRoute(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('Route calculation requires at least two points');
  }

  const cached = getCachedRoute(points);
  if (cached) return cached;
  const route = await fetchOsrmRoute(points);
  cacheRoute(points, route);
  return route;
}

function calcEta(durationSeconds) {
  const etaTimestamp = Date.now() + Math.round((durationSeconds || 0) * 1000);
  return new Date(etaTimestamp).toISOString();
}

export { calculateRoute, calcEta, OSRM_URL };
