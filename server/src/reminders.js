import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { isValidDate, todayInTimezone } from "@sweety/shared";

export const REMINDER_QUEUE = "daily-reminders";
export const REMINDER_PREFIX = "sweety:jobs";
const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 100,
};

export function createReminderQueue(redisUrl, prefix = REMINDER_PREFIX) {
  if (!redisUrl) throw new Error("REDIS_URL is required for reminder jobs.");
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });
  connection.on("error", () => {});
  const queue = new Queue(REMINDER_QUEUE, {
    connection,
    prefix,
    defaultJobOptions: JOB_OPTIONS,
  });
  queue.on("error", (error) =>
    console.error("Reminder queue error:", error.message),
  );
  return { queue, connection };
}

export async function scheduleReminders(queue, config) {
  return queue.upsertJobScheduler(
    "daily-patient-check-in",
    {
      pattern: config.reminderCron,
      tz: config.timezone,
    },
    { name: "daily-check-in", data: {}, opts: JOB_OPTIONS },
  );
}

export function reminderProcessor(pool, config, logger = console) {
  return async (job) => {
    const date = job.data.date || todayInTimezone(config.timezone);
    if (!isValidDate(date) || date > todayInTimezone(config.timezone))
      throw new Error("Invalid reminder date.");
    // Persist the date on the first attempt so a retry after midnight keeps it.
    if (!job.data.date) await job.updateData({ ...job.data, date });
    const { rows } = await pool.query(
      `INSERT INTO reminder_logs(user_id,date,reading_count)
       SELECT u.id,$1::date,COUNT(r.id)::int FROM users u
       LEFT JOIN readings r ON r.user_id=u.id AND r.date=$1::date
       WHERE u.role='patient' GROUP BY u.id HAVING COUNT(r.id)<4
       ON CONFLICT(user_id,date) DO NOTHING RETURNING user_id,date,reading_count`,
      [date],
    );
    for (const reminder of rows) {
      logger.info(
        JSON.stringify({
          type: "daily-reminder",
          ...reminder,
          message: `Daily check-in: ${reminder.reading_count} of 4 readings recorded.`,
        }),
      );
    }
    return { date, remindersLogged: rows.length };
  };
}

export function createReminderWorker(
  pool,
  config,
  { prefix = REMINDER_PREFIX, logger = console } = {},
) {
  if (!config.redisUrl)
    throw new Error("REDIS_URL is required for the reminder worker.");
  // BullMQ workers need unlimited command retries while waiting for Redis.
  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  connection.on("error", (error) =>
    logger.error("Reminder Redis error:", error.message),
  );
  const worker = new Worker(
    REMINDER_QUEUE,
    reminderProcessor(pool, config, logger),
    {
      connection,
      prefix,
      concurrency: 1,
    },
  );
  worker.on("error", (error) =>
    logger.error("Reminder worker error:", error.message),
  );
  worker.on("failed", (job, error) =>
    logger.error(`Reminder job ${job?.id} failed: ${error.message}`),
  );
  return { worker, connection };
}
