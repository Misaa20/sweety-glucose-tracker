import { getConfig } from "./config.js";
import { createPool } from "./db.js";
import { createApp } from "./app.js";
import { createCacheConnection } from "./redis.js";
import { createReportCache } from "./report-cache.js";

const config = getConfig();
const pool = createPool(config.databaseUrl);
await pool.query("SELECT 1");
const redis = createCacheConnection(config.redisUrl);
if (redis) await redis.connect().catch(() => {});
const cache = createReportCache(redis, { ttl: config.reportCacheTtl });
const server = createApp(pool, config, undefined, { cache }).listen(
  config.port,
  () => {
    console.log(`Sweety API listening at http://localhost:${config.port}`);
  },
);
pool.on("error", (error) =>
  console.error("Database connection error:", error.message),
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      redis?.disconnect();
      await pool.end();
      process.exit(0);
    });
  });
}
