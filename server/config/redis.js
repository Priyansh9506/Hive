const Redis = require('ioredis');

let redisClient = null;

const connectRedis = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('⚠ REDIS_URL not set — Redis features disabled. Add REDIS_URL to .env to enable.');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          console.error('Redis: max retries reached, giving up');
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    });

    redisClient.on('connect', () => {
      console.log('Redis Connected');
    });

    redisClient.on('error', (err) => {
      console.error('Redis Error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    return null;
  }
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient };
