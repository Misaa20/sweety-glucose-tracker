import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

export function getConfig() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env first.",
    );
  const timezone = process.env.APP_TIMEZONE || "Asia/Kolkata";
  new Intl.DateTimeFormat("en", { timeZone: timezone });
  const reportCacheTtl = Number(process.env.REPORT_CACHE_TTL || 300);
  if (
    !Number.isInteger(reportCacheTtl) ||
    reportCacheTtl < 1 ||
    reportCacheTtl > 3600
  )
    throw new Error(
      "REPORT_CACHE_TTL must be an integer from 1 to 3600 seconds.",
    );
  return {
    databaseUrl: process.env.DATABASE_URL,
    port: Number(process.env.PORT || 3001),
    clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    timezone,
    production: process.env.NODE_ENV === "production",
    redisUrl: process.env.REDIS_URL || "",
    reportCacheTtl,
    reminderCron: process.env.REMINDER_CRON || "0 21 * * *",
  };
}
