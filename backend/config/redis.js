const { createClient } = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Redis is optional — disabled on cPanel shared hosting by default
const isDisabled = () =>
  process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_HOST;

let client = null;
let connectFailed = false;  // avoid repeated reconnect attempts after failure

const getRedisClient = async () => {
  if (isDisabled())   return null;
  if (connectFailed)  return null;
  if (client && client.isOpen) return client;

  try {
    client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        connectTimeout: 3000,
        reconnectStrategy: false,
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    client.on('error', (err) => {
      logger.warn('Redis error (cache disabled):', err.message);
      connectFailed = true;
    });

    await client.connect();
    logger.info('Redis connected');
    connectFailed = false;
    return client;
  } catch (err) {
    logger.warn('Redis unavailable — running without cache:', err.message);
    connectFailed = true;
    return null;
  }
};

// Safe wrappers — all silently no-op when Redis is unavailable

const setCache = async (key, value, ttlSeconds = 3600) => {
  if (isDisabled()) return;
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn('Redis setCache failed:', err.message);
  }
};

const getCache = async (key) => {
  if (isDisabled()) return null;
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn('Redis getCache failed:', err.message);
    return null;
  }
};

const deleteCache = async (key) => {
  if (isDisabled()) return;
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.del(key);
  } catch (err) {
    logger.warn('Redis deleteCache failed:', err.message);
  }
};

const setSession = async (sessionId, data, ttlSeconds = 604800) => {
  await setCache(`session:${sessionId}`, data, ttlSeconds);
};

const getSession = async (sessionId) => {
  return getCache(`session:${sessionId}`);
};

const deleteSession = async (sessionId) => {
  await deleteCache(`session:${sessionId}`);
};

module.exports = {
  getRedisClient, setCache, getCache, deleteCache,
  setSession, getSession, deleteSession,
};
