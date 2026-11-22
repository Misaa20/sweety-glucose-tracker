import { getConfig } from "./config.js";
import { createPool } from "./db.js";
import {
  createReminderQueue,
  createReminderWorker,
  scheduleReminders,
} from "./reminders.js";

const config = getConfig();
if (!config.redisUrl)
  throw new Error("Set REDIS_URL in .env before running the worker.");
const pool = createPool(config.databaseUrl);
await pool.query("SELECT 1 FROM reminder_logs LIMIT 1");
const producer = createReminderQueue(config.redisUrl);
let consumer;
try {
  await scheduleReminders(producer.queue, config);
  consumer = createReminderWorker(pool, config);
  await consumer.worker.waitUntilReady();
  console.log(
    `Reminder worker ready. Schedule: ${config.reminderCron} (${config.timezone}).`,
  );
} catch (error) {
  await producer.queue.close();
  producer.connection.disconnect();
  await pool.end();
  throw error;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    await consumer.worker.close();
    await producer.queue.close();
    consumer.connection.disconnect();
    producer.connection.disconnect();
    await pool.end();
    process.exit(0);
  });
}
