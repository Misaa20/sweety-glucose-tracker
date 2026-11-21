import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import "../server/src/config.js";

const baseURL = "http://localhost:5173";
const directory = new URL("../docs/screenshots/", import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
  });
  await page.goto(baseURL);
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL("login.png", directory)),
    fullPage: true,
  });
  await page
    .getByLabel("Email address")
    .fill(process.env.DEMO_EMAIL || "demo@sweety.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "SweetyDemo123!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your numbers at a glance" })
    .waitFor();
  await page.getByRole("img", { name: /Line chart/ }).waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL("dashboard.png", directory)),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add reading", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL("reading-form.png", directory)),
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Reports & trends", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A little more perspective." })
    .waitFor();
  await page.getByRole("article", { name: "Previous month" }).waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL("reports.png", directory)),
    fullPage: true,
  });
  await page.getByRole("button", { name: "My readings", exact: true }).click();
  await page
    .getByRole("table", { name: "All your glucose readings" })
    .waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL("history.png", directory)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your numbers at a glance" })
    .waitFor();
  await page.getByRole("img", { name: /Line chart/ }).waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL("mobile.png", directory)),
    fullPage: true,
  });
  console.log("Saved six app screenshots to docs/screenshots.");
} finally {
  await browser.close();
}
