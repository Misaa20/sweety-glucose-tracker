import { chromium, expect } from "@playwright/test";
import "../server/src/config.js";

const baseURL = process.argv[2] || "http://localhost:3001";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page
    .getByLabel("Email address")
    .fill(process.env.DEMO_EMAIL || "demo@sweety.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "SweetyDemo123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Alex." }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("readings");
  await expect(page.getByRole("img", { name: /Line chart/ })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hello, Alex." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page
    .getByLabel("Email address")
    .fill(process.env.DEMO_DOCTOR_EMAIL || "doctor@sweety.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_DOCTOR_PASSWORD || "SweetyDoctor123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your patients, at a glance." }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toBeVisible();
  const patientId = await page.getByLabel("Assigned patient").inputValue();
  const date = await page.getByLabel("Report date").inputValue();
  const reportPath = `/api/doctor/patients/${patientId}/reports?date=${date}`;
  expect((await page.request.get(`${baseURL}${reportPath}`)).status()).toBe(
    200,
  );
  const cached = await page.request.get(`${baseURL}${reportPath}`);
  expect(cached.headers()["x-report-cache"]).toBe("HIT");
  expect(
    (
      await page.request.get(
        `${baseURL}/api/doctor/patients/2147483647/reports`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post(`${baseURL}/api/readings`, {
        data: { date, slot: "morning", value: 100 },
      })
    ).status(),
  ).toBe(403);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Built app verified: patient login/report/chart/session/logout; doctor assigned reports, Redis cache hit, denied unassigned reports and writes; no page errors.",
  );
} finally {
  await browser.close();
}
