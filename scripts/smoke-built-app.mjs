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
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Built app verified: login, daily report, lazy-loaded chart, session reload, logout; no page errors.",
  );
} finally {
  await browser.close();
}
