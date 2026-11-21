import bcrypt from "bcrypt";
import { SLOTS, reportRanges, todayInTimezone } from "@sweety/shared";
import { getConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { migrate } from "./migrate.js";

const config = getConfig();
const pool = createPool(config.databaseUrl);
const email = (process.env.DEMO_EMAIL || "demo@sweety.local")
  .trim()
  .toLowerCase();
const password = process.env.DEMO_PASSWORD || "SweetyDemo123!";
if (password.length < 8 || Buffer.byteLength(password) > 72)
  throw new Error(
    "DEMO_PASSWORD must be 8 characters or more and at most 72 bytes.",
  );

try {
  await migrate(pool);
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      rows: [user],
    } = await client.query(
      `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3)
       ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash
       RETURNING id`,
      ["Alex Morgan", email, hash],
    );
    const today = todayInTimezone(config.timezone);
    const first = reportRanges(today).monthly.start;
    const date = new Date(`${first}T00:00:00Z`);
    let inserted = 0;
    while (date.toISOString().slice(0, 10) <= today) {
      const day = date.toISOString().slice(0, 10);
      const count = day === today ? 3 : date.getUTCDate() % 5 === 0 ? 2 : 4;
      for (let slot = 0; slot < count; slot++) {
        const value =
          day === today
            ? [106, 142, 118][slot]
            : 92 + ((date.getUTCDate() * 7 + slot * 19) % 66);
        const result = await client.query(
          `INSERT INTO readings(user_id,date,slot,value) VALUES($1,$2,$3,$4)
           ON CONFLICT(user_id,date,slot) DO NOTHING`,
          [user.id, day, SLOTS[slot].value, value],
        );
        inserted += result.rowCount;
      }
      date.setUTCDate(date.getUTCDate() + 1);
    }
    await client.query("COMMIT");
    console.log(
      `Demo account ready: ${email}. Added ${inserted} sample readings; existing readings were preserved.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
