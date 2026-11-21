import { Router } from 'express';
import { SLOTS, isValidDate, todayInTimezone, validateReading } from '@sweety/shared';
import { HttpError, validateBody } from './errors.js';

export const SLOT_ORDER = "CASE slot WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END";
const FIELDS = 'id, date, slot, value, created_at, updated_at';

function readingId(value) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 2147483647) throw new HttpError(400, 'Invalid reading ID.');
  return Number(value);
}

function positiveInteger(value, fallback, maximum, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > maximum) {
    throw new HttpError(400, `${label} must be a whole number between 1 and ${maximum}.`);
  }
  return Number(value);
}

export function createReadingsRouter(pool, config) {
  const router = Router();

  router.get('/', async (req, res) => {
    const page = positiveInteger(req.query.page, 1, 1000000, 'Page');
    const limit = positiveInteger(req.query.limit, 20, 100, 'Limit');
    const { from, to } = req.query;
    if ((from !== undefined && !isValidDate(from)) || (to !== undefined && !isValidDate(to))) {
      throw new HttpError(400, 'Please use valid YYYY-MM-DD dates for from and to.');
    }
    if (from && to && from > to) throw new HttpError(400, 'From date must be on or before to date.');
    const params = [req.user.id, from || null, to || null];
    const where = 'user_id=$1 AND ($2::date IS NULL OR date >= $2) AND ($3::date IS NULL OR date <= $3)';
    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM readings WHERE ${where}`, params);
    const { rows } = await pool.query(
      `SELECT ${FIELDS} FROM readings WHERE ${where} ORDER BY date DESC, ${SLOT_ORDER} LIMIT $4 OFFSET $5`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({ readings: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  });

  async function saveReading(req, res, editing) {
    const input = req.body ?? {};
    validateBody(validateReading(input, todayInTimezone(config.timezone)));
    const id = editing ? readingId(req.params.id) : null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize a user's mutations, including date changes, to make error checks race-safe.
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
      if (editing && !(await client.query('SELECT id FROM readings WHERE id=$1 AND user_id=$2', [id, req.user.id])).rowCount) {
        throw new HttpError(404, 'Reading not found.');
      }
      const { rows: existing } = await client.query(
        'SELECT id,slot FROM readings WHERE user_id=$1 AND date=$2 AND ($3::int IS NULL OR id<>$3)',
        [req.user.id, input.date, id],
      );
      if (existing.length >= 4) throw new HttpError(409, 'You can add only 4 readings per day.');
      const duplicateMessage = `You already have an ${SLOTS.find((slot) => slot.value === input.slot).label} reading for this date.`;
      if (existing.some((reading) => reading.slot === input.slot)) {
        throw new HttpError(409, duplicateMessage, { slot: duplicateMessage });
      }
      const result = editing
        ? await client.query(
          `UPDATE readings SET date=$1,slot=$2,value=$3,updated_at=NOW() WHERE id=$4 AND user_id=$5 RETURNING ${FIELDS}`,
          [input.date, input.slot, Number(input.value), id, req.user.id],
        )
        : await client.query(
          `INSERT INTO readings(user_id,date,slot,value) VALUES($1,$2,$3,$4) RETURNING ${FIELDS}`,
          [req.user.id, input.date, input.slot, Number(input.value)],
        );
      await client.query('COMMIT');
      res.status(editing ? 200 : 201).json({ reading: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') throw new HttpError(409, 'You already have a reading for this slot and date.');
      throw error;
    } finally { client.release(); }
  }

  router.post('/', (req, res) => saveReading(req, res, false));
  router.put('/:id', (req, res) => saveReading(req, res, true));
  router.delete('/:id', async (req, res) => {
    const id = readingId(req.params.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
      const result = await client.query('DELETE FROM readings WHERE id=$1 AND user_id=$2', [id, req.user.id]);
      if (!result.rowCount) throw new HttpError(404, 'Reading not found.');
      await client.query('COMMIT');
      res.status(204).end();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });
  return router;
}
