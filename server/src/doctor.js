import { Router } from "express";
import { HttpError } from "./errors.js";
import { patientReport } from "./report-service.js";
import { reportDate } from "./reports.js";

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role)
      throw new HttpError(
        403,
        role === "doctor"
          ? "Doctor access is required."
          : "This action is available to patient accounts only.",
      );
    next();
  };
}

export function createDoctorRouter(pool, config, cache) {
  const router = Router();
  router.get("/patients", async (req, res) => {
    const { rows: patients } = await pool.query(
      `SELECT u.id,u.name,u.email FROM doctor_patients a JOIN users u ON u.id=a.patient_id
       WHERE a.doctor_id=$1 AND u.role='patient' ORDER BY u.name,u.id`,
      [req.user.id],
    );
    res.json({ patients });
  });
  router.get("/patients/:id/reports", async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647)
      throw new HttpError(400, "Invalid patient ID.");
    // Assignment is checked on every request, including cache hits.
    const {
      rows: [patient],
    } = await pool.query(
      `SELECT u.id,u.name,u.email FROM doctor_patients a JOIN users u ON u.id=a.patient_id
       WHERE a.doctor_id=$1 AND a.patient_id=$2 AND u.role='patient'`,
      [req.user.id, req.params.id],
    );
    if (!patient)
      throw new HttpError(404, "Patient not found or not assigned to you.");
    const date = reportDate(req.query.date, config);
    const result = await patientReport(pool, patient.id, date, cache);
    res.setHeader("X-Report-Cache", result.cacheStatus);
    res.json({ patient, ...result.report });
  });
  return router;
}
