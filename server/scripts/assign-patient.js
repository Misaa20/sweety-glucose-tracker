import { getConfig } from "../src/config.js";
import { createPool } from "../src/db.js";

const [doctorEmail, patientEmail] = process.argv.slice(2);
if (!doctorEmail || !patientEmail)
  throw new Error(
    "Usage: npm run doctor:assign -- doctor@example.com patient@example.com",
  );
const pool = createPool(getConfig().databaseUrl);
try {
  const result = await pool.query(
    `INSERT INTO doctor_patients(doctor_id,patient_id)
     SELECT d.id,p.id FROM users d CROSS JOIN users p
     WHERE d.email=$1 AND d.role='doctor' AND p.email=$2 AND p.role='patient'
     ON CONFLICT(doctor_id,patient_id) DO UPDATE SET assigned_at=doctor_patients.assigned_at
     RETURNING doctor_id,patient_id`,
    [doctorEmail.trim().toLowerCase(), patientEmail.trim().toLowerCase()],
  );
  if (!result.rowCount)
    throw new Error(
      "Existing doctor and patient accounts with the correct roles are required.",
    );
  console.log("Patient assigned to doctor.");
} finally {
  await pool.end();
}
