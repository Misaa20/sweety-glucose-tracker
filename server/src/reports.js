import { Router } from "express";
import { isValidDate, todayInTimezone } from "@sweety/shared";
import { HttpError } from "./errors.js";
import { patientReport } from "./report-service.js";

export function reportDate(value, config) {
  const date = value === undefined ? todayInTimezone(config.timezone) : value;
  if (!isValidDate(date))
    throw new HttpError(400, "Please enter a valid report date.");
  if (date > todayInTimezone(config.timezone))
    throw new HttpError(400, "Date cannot be in the future.");
  return date;
}

export function createReportsRouter(pool, config, cache) {
  const router = Router();
  router.get("/", async (req, res) => {
    const date = reportDate(req.query.date, config);
    const result = await patientReport(pool, req.user.id, date, cache);
    res.setHeader("X-Report-Cache", result.cacheStatus);
    res.json(result.report);
  });
  return router;
}
