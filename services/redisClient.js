import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const ENABLE_REDIS = !!REDIS_URL;

let client = null;
let ready = false;
let lastError = null;

function createRedisClient() {
  if (!ENABLE_REDIS) {
    return null;
  }

  const instance = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy(retries) {
        if (retries >= 20) return new Error('Redis reconnection failed');
        return Math.min(retries * 100, 2000);
      },
      connectTimeout: 5000,
    },
  });

  instance.on('error', (err) => {
    ready = false;
    lastError = err;
    console.warn('[Redis] connection error:', err.message || err);
  });

  instance.on('connect', () => {
    console.log('[Redis] connecting to', REDIS_URL);
  });

  instance.on('ready', () => {
    ready = true;
    lastError = null;
    console.log('[Redis] ready');
  });

  instance.on('reconnecting', () => {
    ready = false;
    console.log('[Redis] reconnecting...');
  });

  instance.on('end', () => {
    ready = false;
    console.warn('[Redis] connection closed');
  });

  return instance;
}

const redisClient = createRedisClient();

async function connectRedis() {
  if (!redisClient) {
    console.warn('[Redis] REDIS_URL not configured; Redis fallback disabled.');
    return;
  }
  try {
    await redisClient.connect();
    ready = redisClient.isReady;
  } catch (err) {
    ready = false;
    lastError = err;
    console.warn('[Redis] failed to connect:', err.message || err);
  }
}

async function disconnectRedis() {
  if (!redisClient || !redisClient.isOpen) return;
  try {
    await redisClient.quit();
  } catch (err) {
    console.warn('[Redis] error closing connection:', err.message || err);
  }
}

function isReady() {
  return ready && redisClient && redisClient.isReady;
}

async function safeCall(fn, fallback = null) {
  if (!redisClient || !isReady()) return fallback;
  try {
    return await fn();
  } catch (err) {
    lastError = err;
    console.warn('[Redis] operation failed:', err.message || err);
    return fallback;
  }
}

async function get(key) {
  return safeCall(async () => await redisClient.get(key));
}

async function getJson(key) {
  const raw = await get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[Redis] JSON parse failed for key', key, err.message || err);
    return null;
  }
}

async function set(key, value, options = {}) {
  return safeCall(async () => {
    if (options.EX) {
      return await redisClient.set(key, String(value), { EX: options.EX });
    }
    return await redisClient.set(key, String(value));
  }, null);
}

async function setJson(key, value, options = {}) {
  return set(key, JSON.stringify(value), options);
}

async function del(key) {
  return safeCall(async () => await redisClient.del(key), 0);
}

async function exists(key) {
  return safeCall(async () => (await redisClient.exists(key)) > 0, false);
}

export { redisClient, connectRedis, disconnectRedis, isReady, lastError, get, getJson, set, setJson, del, exists };
