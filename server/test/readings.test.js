import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SLOTS, todayInTimezone } from "@sweety/shared";
import { testContext } from "./helpers.js";

describe("Reading CRUD and validation with PostgreSQL", () => {
  const { pool, agent, request, register } = testContext();
  const date = "2026-01-10";
  const reading = (overrides = {}) => ({
    date,
    slot: "morning",
    value: 100,
    ...overrides,
  });

  it("requires authentication for every reading and report endpoint", async () => {
    await request.get("/api/readings").expect(401);
    await request.post("/api/readings").send(reading()).expect(401);
    await request.put("/api/readings/1").send(reading()).expect(401);
    await request.delete("/api/readings/1").expect(401);
    await request.get("/api/reports").expect(401);
  });

  it("creates, lists, edits date/slot/value, and deletes a reading", async () => {
    const client = agent();
    await register(client);
    const {
      body: { reading: saved },
    } = await client.post("/api/readings").send(reading()).expect(201);
    assert.equal(saved.date, date);
    const updated = await client
      .put(`/api/readings/${saved.id}`)
      .send(reading({ date: "2026-01-11", slot: "after_lunch", value: 130 }))
      .expect(200);
    assert.equal(updated.body.reading.value, 130);
    assert.equal(updated.body.reading.slot, "after_lunch");
    assert.equal(updated.body.reading.date, "2026-01-11");
    const list = await client.get("/api/readings").expect(200);
    assert.equal(list.body.pagination.total, 1);
    await client.delete(`/api/readings/${saved.id}`).expect(204);
    assert.equal((await client.get("/api/readings")).body.pagination.total, 0);
  });

  it("validates required values, integers, boundaries, real dates, slots, and future dates", async () => {
    const client = agent();
    await register(client);
    for (const value of [
      "",
      null,
      undefined,
      " ",
      39,
      601,
      100.5,
      "1e2",
      "100.0",
      true,
      {},
      [],
    ]) {
      const result = await client
        .post("/api/readings")
        .send(reading({ value }))
        .expect(400);
      assert.ok(
        result.body.errors.value,
        `Missing value error for ${String(value)}`,
      );
    }
    for (const input of [
      { date: "2026-02-30" },
      { date: "1899-12-31" },
      { date: "2999-01-01" },
      { slot: "snack" },
    ]) {
      await client.post("/api/readings").send(reading(input)).expect(400);
    }
    await client
      .post("/api/readings")
      .send(reading({ date: todayInTimezone(), value: 40 }))
      .expect(201);
    await client
      .post("/api/readings")
      .send(
        reading({
          date: todayInTimezone(),
          slot: "after_breakfast",
          value: 600,
        }),
      )
      .expect(201);
  });

  it("enforces one slot per day and maximum four, including concurrent submissions", async () => {
    const client = agent();
    await register(client);
    const results = await Promise.all([
      client.post("/api/readings").send(reading()),
      client.post("/api/readings").send(reading()),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.match(
      results.find((r) => r.status === 409).body.message,
      /already have/,
    );
    for (const slot of SLOTS.slice(1))
      await client
        .post("/api/readings")
        .send(reading({ slot: slot.value }))
        .expect(201);
    const full = await client.post("/api/readings").send(reading()).expect(409);
    assert.equal(full.body.message, "You can add only 4 readings per day.");
    const first = (await client.get("/api/readings")).body.readings[0];
    await client
      .put(`/api/readings/${first.id}`)
      .send(reading({ value: 120 }))
      .expect(200);
    const another = await client
      .post("/api/readings")
      .send(reading({ date: "2026-01-09" }))
      .expect(201);
    await client
      .put(`/api/readings/${another.body.reading.id}`)
      .send(reading())
      .expect(409);
    assert.equal((await client.get("/api/readings")).body.pagination.total, 5);
  });

  it("prevents editing into an occupied slot without changing the original reading", async () => {
    const client = agent();
    await register(client);
    const first = await client
      .post("/api/readings")
      .send(reading())
      .expect(201);
    await client
      .post("/api/readings")
      .send(reading({ slot: "after_lunch" }))
      .expect(201);
    await client
      .put(`/api/readings/${first.body.reading.id}`)
      .send(reading({ slot: "after_lunch" }))
      .expect(409);
    assert.equal(
      (await client.get("/api/readings")).body.readings[0].slot,
      "morning",
    );
  });

  it("isolates users across lists, mutations and reports even when user_id is supplied", async () => {
    const owner = agent();
    const other = agent();
    await register(owner);
    await register(other, "other@example.com");
    const saved = await owner
      .post("/api/readings")
      .send(reading({ user_id: 2 }))
      .expect(201);
    assert.equal((await other.get("/api/readings")).body.pagination.total, 0);
    assert.equal(
      (await other.get(`/api/reports?date=${date}`)).body.daily.count,
      0,
    );
    await other
      .put(`/api/readings/${saved.body.reading.id}`)
      .send(reading())
      .expect(404);
    await other.delete(`/api/readings/${saved.body.reading.id}`).expect(404);
    const {
      rows: [row],
    } = await pool.query("SELECT user_id FROM readings");
    assert.equal(row.user_id, 1);
  });

  it("paginates, filters and rejects malformed parameters", async () => {
    const client = agent();
    await register(client);
    for (const slot of SLOTS)
      await client
        .post("/api/readings")
        .send(reading({ slot: slot.value }))
        .expect(201);
    const result = await client.get("/api/readings?page=2&limit=2").expect(200);
    assert.equal(result.body.readings.length, 2);
    assert.deepEqual(result.body.pagination, {
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
    });
    assert.equal(
      (await client.get("/api/readings?from=2026-01-11&to=2026-01-12")).body
        .pagination.total,
      0,
    );
    for (const query of [
      "page=0",
      "limit=101",
      "page=1.5",
      "from=bad",
      "from=2026-01-12&to=2026-01-01",
      "page=1&page=2",
    ]) {
      await client.get(`/api/readings?${query}`).expect(400);
    }
    await client.delete("/api/readings/invalid").expect(400);
    await client.delete("/api/readings/999999999999").expect(400);
  });
});
