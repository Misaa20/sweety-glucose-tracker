import { test, expect } from "@playwright/test";

test("patient journey: registration, validation, CRUD, reports, isolation and login", async ({
  page,
  request,
}) => {
  const { today } = await (await request.get("/api/meta")).json();
  const email = `journey-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const password = "BrowserTest123!";
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Test Patient");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Test." }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("No readings just yet.");

  await page
    .getByRole("button", { name: "Add Morning (fasting) reading", exact: true })
    .click();
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByText("Please enter a glucose value.")).toBeVisible();
  await page.getByLabel(/Glucose value/).fill("39");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(
    page.getByText("Value must be a whole number between 40 and 600 mg/dl."),
  ).toBeVisible();
  await page.getByLabel(/Glucose value/).fill("120");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("120.0");

  await page
    .getByRole("button", {
      name: "Edit Morning (fasting) reading",
      exact: true,
    })
    .click();
  await page.getByLabel(/Glucose value/).fill("135");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("135.0");

  for (const [slot, value] of [
    ["After breakfast", "145"],
    ["After lunch", "125"],
    ["After dinner", "115"],
  ]) {
    await page
      .getByRole("button", { name: `Add ${slot} reading`, exact: true })
      .click();
    await page.getByLabel(/Glucose value/).fill(value);
    await page
      .getByRole("button", { name: "Save reading", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: `Edit ${slot} reading`, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("130.0");
  await page.getByRole("button", { name: "Add reading", exact: true }).click();
  await page.getByLabel(/Glucose value/).fill("110");
  await page.getByRole("button", { name: "Save reading", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "You can add only 4 readings per day.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page
    .getByRole("button", {
      name: "Delete After breakfast reading",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Delete reading", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Add After breakfast reading",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("125.0");

  await page.getByRole("button", { name: "My readings", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "All your glucose readings" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Reports & trends", exact: true })
    .click();
  await page.getByLabel("Report date").fill("2026-10-15");
  await expect(
    page.getByRole("article", { name: "Previous month" }),
  ).toContainText("1 Sept – 30 Sept 2026");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByLabel("Report date")).toHaveValue(today);

  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Other Patient");
  await page.getByLabel("Email address").fill(`other-${email}`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("No readings just yet.");
  await page.getByRole("button", { name: "My readings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh page for your readings." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Test." }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Daily report" }),
  ).toContainText("3 readings");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hello, Test." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
