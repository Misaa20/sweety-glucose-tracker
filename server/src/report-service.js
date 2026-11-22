import { reportRanges } from "@sweety/shared";
import { SLOT_ORDER } from "./readings.js";
import { HttpError } from "./errors.js";

export async function patientReport(pool, patientId, date, cache) {
  const ranges = reportRanges(date);
  const client = await pool.connect();
  let report;
  let version;
  const cacheStatus = cache?.available() ? "MISS" : "BYPASS";
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const {
      rows: [patient],
    } = await client.query("SELECT report_version FROM users WHERE id=$1", [
      patientId,
    ]);
    if (!patient) throw new HttpError(404, "Patient not found.");
    version = patient.report_version;
    const hit = await cache?.get(patientId, version, date);
    if (hit) {
      await client.query("COMMIT");
      return { report: hit, cacheStatus: "HIT" };
    }
    const summaries = {};
    for (const [key, range] of Object.entries(ranges)) {
      const {
        rows: [summary],
      } = await client.query(
        `SELECT COUNT(*)::int AS count, MAX(value)::int AS highest, MIN(value)::int AS lowest,
         ROUND(AVG(value),1)::float8 AS average FROM readings WHERE user_id=$1 AND date BETWEEN $2 AND $3`,
        [patientId, range.start, range.end],
      );
      summaries[key] = { ...range, ...summary };
    }
    const { rows: readings } = await client.query(
      `SELECT id,date,slot,value FROM readings WHERE user_id=$1 AND date=$2 ORDER BY ${SLOT_ORDER}`,
      [patientId, date],
    );
    const { rows: trend } = await client.query(
      `SELECT date, ROUND(AVG(value),1)::float8 AS average, COUNT(*)::int AS count FROM readings
       WHERE user_id=$1 AND date >= $2::date AND date < $2::date + INTERVAL '1 month'
       GROUP BY date ORDER BY date`,
      [patientId, ranges.monthToDate.start],
    );
    report = { date, ...summaries, readings, trend };
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await cache?.set(patientId, version, date, report);
  return { report, cacheStatus };
}
