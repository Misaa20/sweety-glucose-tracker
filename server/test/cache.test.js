import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import supertest from "supertest";
import { testContext } from "./helpers.js";
import { createReportCache } from "../src/report-cache.js";
import { patientReport } from "../src/report-service.js";
import { createApp } from "../src/app.js";

describe(
  "Real Redis report cache",
  { skip: !process.env.TEST_REDIS_URL },
  () => {
    const redis = new Redis(process.env.TEST_REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.on("error", () => {});
    const prefix = `sweety:test:${randomUUID()}`;
    const cache = createReportCache(redis, { prefix, ttl: 300 });
    const { pool, agent, register, config } = testContext({ cache });
    const keys = () => redis.keys(`${prefix}:*`);
    const clear = async () => {
      const found = await keys();
      if (found.length) await redis.del(...found);
    };
    before(async () => {
      await redis.connect();
    });
    beforeEach(clear);
    after(async () => {
      await clear();
      redis.disconnect();
    });

    it("caches reports per patient/date with TTL and shares authorized patient reports with a doctor", async () => {
      const patient = agent();
      const {
        body: { user },
      } = await register(patient);
      await patient
        .post("/api/readings")
        .send({ date: "2026-01-10", slot: "morning", value: 120 })
        .expect(201);
      const first = await patient
        .get("/api/reports?date=2026-01-10")
        .expect(200);
      assert.equal(first.headers["x-report-cache"], "MISS");
      const second = await patient
        .get("/api/reports?date=2026-01-10")
        .expect(200);
      assert.equal(second.headers["x-report-cache"], "HIT");
      assert.deepEqual(first.body, second.body);
      assert.equal(second.headers["cache-control"], "no-store");
      assert.ok((await redis.ttl((await keys())[0])) > 0);
      const other = agent();
      await register(other, "other@example.com");
      assert.equal(
        (await other.get("/api/reports?date=2026-01-10")).body.daily.count,
        0,
      );
      const doc = agent();
      const {
        body: { user: doctor },
      } = await register(doc, "doctor@example.com");
      await pool.query("UPDATE users SET role='doctor' WHERE id=$1", [
        doctor.id,
      ]);
      await pool.query(
        "INSERT INTO doctor_patients(doctor_id,patient_id) VALUES($1,$2)",
        [doctor.id, user.id],
      );
      const shared = await doc
        .get(`/api/doctor/patients/${user.id}/reports?date=2026-01-10`)
        .expect(200);
      assert.equal(shared.headers["x-report-cache"], "HIT");
      assert.equal(shared.body.daily.average, 120);
      await pool.query("DELETE FROM doctor_patients WHERE doctor_id=$1", [
        doctor.id,
      ]);
      await doc
        .get(`/api/doctor/patients/${user.id}/reports?date=2026-01-10`)
        .expect(404);
    });

    it("clears every report date after create, date/slot/value edit, and delete", async () => {
      const client = agent();
      await register(client);
      for (const date of ["2026-01-10", "2026-02-01"])
        await client.get(`/api/reports?date=${date}`).expect(200);
      assert.equal((await keys()).length, 2);
      const {
        body: { reading },
      } = await client
        .post("/api/readings")
        .send({ date: "2026-01-10", slot: "morning", value: 100 })
        .expect(201);
      assert.equal((await keys()).length, 0);
      assert.equal(
        (await client.get("/api/reports?date=2026-01-10")).body.daily.count,
        1,
      );
      assert.equal(
        (await client.get("/api/reports?date=2026-02-01")).body.monthly.count,
        1,
      );
      await client
        .put(`/api/readings/${reading.id}`)
        .send({ date: "2026-02-01", slot: "after_lunch", value: 200 })
        .expect(200);
      assert.equal((await keys()).length, 0);
      assert.equal(
        (await client.get("/api/reports?date=2026-01-10")).body.daily.count,
        0,
      );
      assert.equal(
        (await client.get("/api/reports?date=2026-02-01")).body.daily.average,
        200,
      );
      await client.delete(`/api/readings/${reading.id}`).expect(204);
      assert.equal((await keys()).length, 0);
      assert.equal(
        (await client.get("/api/reports?date=2026-02-01")).body.daily.count,
        0,
      );
    });

    it("cannot resurrect stale results when a slow cache fill finishes after a committed mutation", async () => {
      const client = agent();
      const {
        body: { user },
      } = await register(client);
      let markReady, release;
      const ready = new Promise((resolve) => {
        markReady = resolve;
      });
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const oldRequest = patientReport(pool, user.id, "2026-01-10", {
        ...cache,
        set: async (...args) => {
          markReady();
          await gate;
          await cache.set(...args);
        },
      });
      await ready;
      try {
        await client
          .post("/api/readings")
          .send({ date: "2026-01-10", slot: "morning", value: 135 })
          .expect(201);
      } finally {
        release();
      }
      assert.equal((await oldRequest).report.daily.count, 0);
      const current = await client
        .get("/api/reports?date=2026-01-10")
        .expect(200);
      assert.equal(current.headers["x-report-cache"], "MISS");
      assert.equal(current.body.daily.average, 135);
      assert.equal(
        (await client.get("/api/reports?date=2026-01-10")).headers[
          "x-report-cache"
        ],
        "HIT",
      );
    });

    it("keeps reports and reading mutations working when the Redis connection is unavailable", async () => {
      const offline = new Redis(process.env.TEST_REDIS_URL, {
        lazyConnect: true,
      });
      offline.disconnect();
      const app = createApp(
        pool,
        config,
        { bcryptRounds: 4, rateLimitMax: 1000 },
        { cache: createReportCache(offline) },
      );
      const client = supertest.agent(app);
      await register(client);
      const saved = await client
        .post("/api/readings")
        .send({ date: "2026-01-10", slot: "morning", value: 140 })
        .expect(201);
      const report = await client
        .get("/api/reports?date=2026-01-10")
        .expect(200);
      assert.equal(report.headers["x-report-cache"], "BYPASS");
      assert.equal(report.body.daily.average, 140);
      await client.delete(`/api/readings/${saved.body.reading.id}`).expect(204);
    });
  },
);
