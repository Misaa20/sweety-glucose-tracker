import { randomUUID } from "node:crypto";
import { QueueEvents } from "bullmq";
import { isValidDate, todayInTimezone } from "@sweety/shared";
import { getConfig } from "../src/config.js";
import {
  createReminderQueue,
  REMINDER_QUEUE,
  REMINDER_PREFIX,
} from "../src/reminders.js";

const config = getConfig();
const date = process.argv[2] || todayInTimezone(config.timezone);
if (!isValidDate(date) || date > todayInTimezone(config.timezone))
  throw new Error("Please use a valid reminder date on or before today.");
const { queue, connection } = createReminderQueue(config.redisUrl);
const eventsConnection = connection.duplicate({ maxRetriesPerRequest: null });
eventsConnection.on("error", () => {});
const events = new QueueEvents(REMINDER_QUEUE, {
  connection: eventsConnection,
  prefix: REMINDER_PREFIX,
});
try {
  await events.waitUntilReady();
  const job = await queue.add(
    "daily-check-in",
    { date },
    { jobId: `manual-${randomUUID()}` },
  );
  console.log(
    `Queued reminder job ${job.id}; waiting for the worker (15 seconds).`,
  );
  const result = await job.waitUntilFinished(events, 15000);
  console.log(
    `Reminder check complete for ${result.date}: ${result.remindersLogged} new daily logs.`,
  );
} finally {
  await events.close();
  await queue.close();
  eventsConnection.disconnect();
  connection.disconnect();
}
