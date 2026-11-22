import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { QueueEvents } from "bullmq";
import { SLOTS } from "@sweety/shared";
import { testContext } from "./helpers.js";
import {
  createReminderQueue,
  createReminderWorker,
  REMINDER_QUEUE,
  scheduleReminders,
} from "../src/reminders.js";

describe(
  "Real BullMQ reminder jobs",
  { skip: !process.env.TEST_REDIS_URL },
  () => {
    const { pool, agent, register } = testContext();
    const prefix = `sweety-test-${randomUUID()}`;
    const config = {
      redisUrl: process.env.TEST_REDIS_URL,
      timezone: "Asia/Kolkata",
      reminderCron: "0 21 * * *",
    };
    const logs = [];
    const logger = {
      info: (line) => logs.push(JSON.parse(line)),
      error: () => {},
    };
    let producer, consumer, events, eventsConnection;
    before(async () => {
      producer = createReminderQueue(config.redisUrl, prefix);
      eventsConnection = producer.connection.duplicate({
        maxRetriesPerRequest: null,
      });
      eventsConnection.on("error", () => {});
      events = new QueueEvents(REMINDER_QUEUE, {
        prefix,
        connection: eventsConnection,
      });
      consumer = createReminderWorker(pool, config, { prefix, logger });
      await Promise.all([
        events.waitUntilReady(),
        consumer.worker.waitUntilReady(),
      ]);
    });
    beforeEach(() => {
      logs.length = 0;
    });
    after(async () => {
      await consumer.worker.close();
      await events.close();
      await producer.queue.obliterate({ force: true });
      await producer.queue.close();
      eventsConnection.disconnect();
      consumer.connection.disconnect();
      producer.connection.disconnect();
    });
    async function run(date = "2026-01-10") {
      const job = await producer.queue.add(
        "daily-check-in",
        { date },
        { jobId: `test-${randomUUID()}` },
      );
      return job.waitUntilFinished(events, 15000);
    }

    it("processes queued jobs for patients with 0–3 readings, excluding full days and doctors", async () => {
      const expected = [];
      for (const count of [0, 1, 3, 4]) {
        const {
          body: { user },
        } = await register(agent(), `patient-${count}@example.com`);
        if (count < 4) expected.push(user.id);
        for (const slot of SLOTS.slice(0, count))
          await pool.query(
            "INSERT INTO readings(user_id,date,slot,value) VALUES($1,$2,$3,100)",
            [user.id, "2026-01-10", slot.value],
          );
      }
      const {
        body: { user: doctor },
      } = await register(agent(), "doctor@example.com");
      await pool.query("UPDATE users SET role='doctor' WHERE id=$1", [
        doctor.id,
      ]);
      assert.deepEqual(await run(), { date: "2026-01-10", remindersLogged: 3 });
      assert.deepEqual(
        logs.map((row) => row.user_id).sort((a, b) => a - b),
        expected,
      );
      assert.deepEqual(logs.map((row) => row.reading_count).sort(), [0, 1, 3]);
      assert.equal(
        (await pool.query("SELECT * FROM reminder_logs")).rowCount,
        3,
      );
    });

    it("keeps daily reminder logs idempotent when a job is repeated or retried", async () => {
      await register(agent());
      assert.equal((await run()).remindersLogged, 1);
      assert.equal((await run()).remindersLogged, 0);
      assert.equal(logs.length, 1);
      assert.equal(
        (await pool.query("SELECT * FROM reminder_logs")).rowCount,
        1,
      );
      assert.equal((await run("2026-01-11")).remindersLogged, 1);
    });

    it("registers a single daily timezone-aware scheduler across worker restarts", async () => {
      await scheduleReminders(producer.queue, config);
      await scheduleReminders(producer.queue, config);
      const schedulers = await producer.queue.getJobSchedulers();
      assert.equal(schedulers.length, 1);
      assert.equal(schedulers[0].pattern, "0 21 * * *");
      assert.equal(schedulers[0].tz, "Asia/Kolkata");
      await producer.queue.removeJobScheduler("daily-patient-check-in");
    });
  },
);
