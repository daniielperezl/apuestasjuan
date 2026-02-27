const { createClient } = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

let client = null;

const getRedisClient = async () => {
  if (client && client.isOpen) return client;

  client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379
    },
    password: process.env.REDIS_PASSWORD || undefined
  });

  client.on('error', (err) => logger.error('Redis error:', err));
  client.on('connect', () => logger.info('Redis connected'));

  await client.connect();
  return client;
};

const setCache = async (key, value, ttlSeconds = 3600) => {
  const redis = await getRedisClient();
  await redis.setEx(key, ttlSeconds, JSON.stringify(value));
};

const getCache = async (key) => {
  const redis = await getRedisClient();
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

const deleteCache = async (key) => {
  const redis = await getRedisClient();
  await redis.del(key);
};

const setSession = async (sessionId, data, ttlSeconds = 604800) => {
  const redis = await getRedisClient();
  await redis.setEx(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
};

const getSession = async (sessionId) => {
  const redis = await getRedisClient();
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
};

const deleteSession = async (sessionId) => {
  const redis = await getRedisClient();
  await redis.del(`session:${sessionId}`);
};

module.exports = { getRedisClient, setCache, getCache, deleteCache, setSession, getSession, deleteSession };
