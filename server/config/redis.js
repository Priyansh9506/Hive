const Redis = require('ioredis');

let redisClient = null;
let subClient = null;

const connectRedis = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('⚠ REDIS_URL not set — Redis features disabled. Add REDIS_URL to .env to enable.');
    return null;
  }

  const opts = {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) {
        console.error('Redis: max retries reached, giving up');
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  };

  try {
    redisClient = new Redis(redisUrl, opts);
    subClient = redisClient.duplicate(); // Socket.IO adapter needs a separate subscriber

    redisClient.on('connect', () => {
      console.log('Redis Connected (pub)');
    });

    subClient.on('connect', () => {
      console.log('Redis Connected (sub)');
    });

    redisClient.on('error', (err) => {
      console.error('Redis Pub Error:', err.message);
    });

    subClient.on('error', (err) => {
      console.error('Redis Sub Error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('Redis pub connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    return null;
  }
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient, get redisClient() { return redisClient; }, get subClient() { return subClient; } };

