import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportRanges, todayInTimezone } from "@sweety/shared";
import { testContext } from "./helpers.js";

describe("Report ranges and aggregates with PostgreSQL", () => {
  const { pool, agent, register } = testContext();

  it("uses exact inclusive ranges, one-decimal averages, slot ordering and user scope", async () => {
    const client = agent();
    await register(client);
    await register(agent(), "other@example.com");
    for (const [date, slot, value, user] of [
      ["2026-08-31", "morning", 600, 1],
      ["2026-09-01", "morning", 80, 1],
      ["2026-09-30", "morning", 120, 1],
      ["2026-10-01", "morning", 90, 1],
      ["2026-10-15", "after_lunch", 101, 1],
      ["2026-10-15", "morning", 100, 1],
      ["2026-10-15", "after_dinner", 105, 1],
      ["2026-10-16", "morning", 500, 1],
      ["2026-10-15", "morning", 600, 2],
    ])
      await pool.query(
        "INSERT INTO readings(user_id,date,slot,value) VALUES($1,$2,$3,$4)",
        [user, date, slot, value],
      );
    const { body } = await client
      .get("/api/reports?date=2026-10-15")
      .expect(200);
    assert.deepEqual(body.daily, {
      start: "2026-10-15",
      end: "2026-10-15",
      count: 3,
      lowest: 100,
      highest: 105,
      average: 102,
    });
    assert.deepEqual(body.monthToDate, {
      start: "2026-10-01",
      end: "2026-10-15",
      count: 4,
      lowest: 90,
      highest: 105,
      average: 99,
    });
    assert.deepEqual(body.monthly, {
      start: "2026-09-01",
      end: "2026-09-30",
      count: 2,
      lowest: 80,
      highest: 120,
      average: 100,
    });
    assert.deepEqual(
      body.readings.map((row) => row.slot),
      ["morning", "after_lunch", "after_dinner"],
    );
    assert.equal(body.trend.length, 3);
    await pool.query(
      "UPDATE readings SET value=106 WHERE user_id=1 AND date=$1 AND slot=$2",
      ["2026-10-15", "after_dinner"],
    );
    const changed = await client
      .get("/api/reports?date=2026-10-15")
      .expect(200);
    assert.equal(changed.body.daily.average, 102.3);
  });

  it("handles January rollover, leap years, empty reports and invalid dates", async () => {
    assert.deepEqual(reportRanges("2026-01-01").monthly, {
      start: "2025-12-01",
      end: "2025-12-31",
    });
    assert.deepEqual(reportRanges("2024-03-15").monthly, {
      start: "2024-02-01",
      end: "2024-02-29",
    });
    assert.deepEqual(reportRanges("2025-03-15").monthly, {
      start: "2025-02-01",
      end: "2025-02-28",
    });
    assert.equal(
      todayInTimezone("Asia/Kolkata", new Date("2026-10-14T20:00:00Z")),
      "2026-10-15",
    );
    const client = agent();
    await register(client);
    const { body } = await client
      .get("/api/reports?date=2026-01-01")
      .expect(200);
    for (const key of ["daily", "monthToDate", "monthly"]) {
      assert.equal(body[key].count, 0);
      assert.equal(body[key].average, null);
      assert.equal(body[key].highest, null);
      assert.equal(body[key].lowest, null);
    }
    assert.deepEqual(body.readings, []);
    assert.deepEqual(body.trend, []);
    await client.get("/api/reports?date=2026-02-30").expect(400);
    await client.get("/api/reports?date=2999-01-01").expect(400);
  });
});
