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
const doctorEmail = (process.env.DEMO_DOCTOR_EMAIL || "doctor@sweety.local")
  .trim()
  .toLowerCase();
const doctorPassword = process.env.DEMO_DOCTOR_PASSWORD || "SweetyDoctor123!";
if (doctorEmail === email)
  throw new Error(
    "Demo patient and doctor must use different email addresses.",
  );
if (doctorPassword.length < 8 || Buffer.byteLength(doctorPassword) > 72)
  throw new Error(
    "DEMO_DOCTOR_PASSWORD must be 8 characters or more and at most 72 bytes.",
  );
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
       ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash WHERE users.role='patient'
       RETURNING id`,
      ["Alex Morgan", email, hash],
    );
    if (!user)
      throw new Error(
        "Demo patient email belongs to a doctor account; choose another DEMO_EMAIL.",
      );
    const doctorHash = await bcrypt.hash(doctorPassword, 12);
    const {
      rows: [doctor],
    } = await client.query(
      `INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'doctor')
       ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash WHERE users.role='doctor'
       RETURNING id`,
      ["Dr. Maya Patel", doctorEmail, doctorHash],
    );
    if (!doctor)
      throw new Error(
        "Demo doctor email belongs to a patient account; choose another DEMO_DOCTOR_EMAIL.",
      );
    await client.query(
      "INSERT INTO doctor_patients(doctor_id,patient_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [doctor.id, user.id],
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
    console.log(
      `Demo doctor ready: ${doctorEmail}. Assigned to the demo patient.`,
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
