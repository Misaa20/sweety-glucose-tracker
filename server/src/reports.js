import { Router } from 'express';
import { isValidDate, reportRanges, todayInTimezone } from '@sweety/shared';
import { SLOT_ORDER } from './readings.js';
import { HttpError } from './errors.js';

export function createReportsRouter(pool, config) {
  const router = Router();
  router.get('/', async (req, res) => {
    const date = req.query.date || todayInTimezone(config.timezone);
    if (!isValidDate(date)) throw new HttpError(400, 'Please enter a valid report date.');
    if (date > todayInTimezone(config.timezone)) throw new HttpError(400, 'Date cannot be in the future.');
    const ranges = reportRanges(date);
    const client = await pool.connect();
    try {
      // All summaries, daily rows and chart points see the same database snapshot.
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const reports = {};
      for (const [key, range] of Object.entries(ranges)) {
        const { rows: [summary] } = await client.query(
          `SELECT COUNT(*)::int AS count, MAX(value)::int AS highest, MIN(value)::int AS lowest,
           ROUND(AVG(value),1)::float8 AS average FROM readings WHERE user_id=$1 AND date BETWEEN $2 AND $3`,
          [req.user.id, range.start, range.end],
        );
        reports[key] = { ...range, ...summary };
      }
      const { rows: readings } = await client.query(
        `SELECT id,date,slot,value FROM readings WHERE user_id=$1 AND date=$2 ORDER BY ${SLOT_ORDER}`, [req.user.id, date],
      );
      const { rows: trend } = await client.query(
        `SELECT date, ROUND(AVG(value),1)::float8 AS average, COUNT(*)::int AS count FROM readings
         WHERE user_id=$1 AND date >= $2::date AND date < $2::date + INTERVAL '1 month'
         GROUP BY date ORDER BY date`, [req.user.id, ranges.monthToDate.start],
      );
      await client.query('COMMIT');
      res.json({ date, ...reports, readings, trend });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });
  return router;
}
