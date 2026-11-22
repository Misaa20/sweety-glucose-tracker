import Redis from "ioredis";

export function createCacheConnection(url, logger = console) {
  if (!url) return null;
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 1000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });
  let lastWarning = 0;
  redis.on("error", () => {
    if (Date.now() - lastWarning > 60000) {
      logger.warn("Report cache unavailable; reports will use PostgreSQL.");
      lastWarning = Date.now();
    }
  });
  return redis;
}
