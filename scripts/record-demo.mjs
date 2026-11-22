import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, expect } from "@playwright/test";
import { SLOTS } from "@sweety/shared";
import { getConfig } from "../server/src/config.js";
import { createPool } from "../server/src/db.js";

const execute = promisify(execFile);
const args = process.argv.slice(2);
const check = args.includes("--check");
const baseURL =
  args.find((arg) => /^https?:\/\//.test(arg)) || "http://localhost:5173";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = fileURLToPath(new URL("../docs/demo/", import.meta.url));
const temporary = fileURLToPath(
  new URL("../.local/recording-takes/", import.meta.url),
);
const localFfmpeg = resolve(root, ".local/video-tools/ffmpeg.exe");
const ffmpegIndex = args.indexOf("--ffmpeg");
const ffmpeg =
  ffmpegIndex >= 0
    ? resolve(args[ffmpegIndex + 1])
    : existsSync(localFfmpeg)
      ? localFfmpeg
      : "ffmpeg";
if (!check) await execute(ffmpeg, ["-version"], { windowsHide: true });
await mkdir(output, { recursive: true });
await mkdir(temporary, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ...(!check && {
    recordVideo: { dir: temporary, size: { width: 1440, height: 900 } },
  }),
});
const recordingStart = performance.now();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const cues = [];
const pool = createPool(getConfig().databaseUrl);
let createdReading = null;
let createdUser = null;
let patientId;
let videoPath;

const pause = (seconds) =>
  check
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, seconds * 1000));
async function click(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  await pause(0.15);
  await locator.click();
}
async function type(label, value) {
  const input = page.getByLabel(label, { exact: typeof label === "string" });
  await click(input);
  await input.fill("");
  await input.pressSequentially(value, { delay: check ? 0 : 30 });
}
async function scene(title, text, seconds, action) {
  console.log(`Recording: ${title}`);
  const start = performance.now();
  const cue = { title, text, start: (start - recordingStart) / 1000, end: 0 };
  cues.push(cue);
  await action();
  await pause(Math.max(0, seconds - (performance.now() - start) / 1000));
  cue.end = (performance.now() - recordingStart) / 1000;
}
async function scroll(locator) {
  await locator.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "smooth" }),
  );
  await pause(0.65);
}
async function login(email, password) {
  await type("Email address", email);
  await type("Password", password);
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST",
  );
  await click(page.getByRole("button", { name: "Log in", exact: true }));
  const result = await response;
  if (!result.ok()) throw new Error(`Demo login failed (${result.status()}).`);
  return (await result.json()).user;
}
function clock(seconds, milliseconds = false) {
  const parts = new Date(Math.round(seconds * 1000))
    .toISOString()
    .slice(11, 23);
  return milliseconds ? parts : parts.slice(0, 11);
}

try {
  await page.goto(baseURL);
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();

  await scene(
    "Welcome to Sweety",
    "A simple glucose journal built with React, Express, Node.js and PostgreSQL.",
    8,
    async () => {},
  );
  await scene(
    "Patient login",
    "Sign in to a private journal. Passwords remain masked throughout this recording.",
    10,
    async () => {
      const user = await login(
        process.env.DEMO_EMAIL || "demo@sweety.local",
        process.env.DEMO_PASSWORD || "SweetyDemo123!",
      );
      patientId = user.id;
      await page
        .getByRole("heading", { name: "Your numbers at a glance" })
        .waitFor();
      await page.getByRole("img", { name: /Line chart/ }).waitFor();
    },
  );

  const { today } = await (
    await page.request.get(`${baseURL}/api/meta`)
  ).json();
  let date = today;
  let baseline;
  let slot;
  for (let days = 0; days < 10; days++) {
    const candidate = new Date(`${today}T00:00:00Z`);
    candidate.setUTCDate(candidate.getUTCDate() - days);
    date = candidate.toISOString().slice(0, 10);
    const response = await page.request.get(
      `${baseURL}/api/reports?date=${date}`,
    );
    if (!response.ok())
      throw new Error("Could not load the demo patient report.");
    baseline = await response.json();
    slot = [SLOTS[3], ...SLOTS.slice(0, 3)].find(
      (item) =>
        !baseline.readings.some((reading) => reading.slot === item.value),
    );
    if (slot) break;
  }
  if (!slot)
    throw new Error(
      "The demo needs an available reading slot. Existing readings were preserved.",
    );

  await scene(
    "Four daily check-ins",
    "Record a date, one of four meal-time slots, and a whole-number glucose value in mg/dl.",
    12,
    async () => {
      if (date !== today) await page.getByLabel("Report date").fill(date);
      await page
        .getByRole("button", { name: `Add ${slot.label} reading`, exact: true })
        .waitFor();
      await scroll(page.locator(".daily-section"));
    },
  );

  await scene(
    "Validation and a new reading",
    "Clear errors catch missing values, values outside 40–600 mg/dl, duplicate slots and full days.",
    22,
    async () => {
      await click(
        page.getByRole("button", {
          name: `Add ${slot.label} reading`,
          exact: true,
        }),
      );
      await click(
        page.getByRole("button", { name: "Save reading", exact: true }),
      );
      await expect(
        page.getByText("Please enter a glucose value."),
      ).toBeVisible();
      await pause(2);
      await type(/Glucose value/, "39");
      await click(
        page.getByRole("button", { name: "Save reading", exact: true }),
      );
      await expect(
        page.getByText(
          "Value must be a whole number between 40 and 600 mg/dl.",
        ),
      ).toBeVisible();
      await pause(2);
      await type(/Glucose value/, "128");
      const savedResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/readings") &&
          response.request().method() === "POST",
      );
      await click(
        page.getByRole("button", { name: "Save reading", exact: true }),
      );
      const saved = await savedResponse;
      if (saved.status() !== 201)
        throw new Error("The demonstration reading could not be saved.");
      createdReading = (await saved.json()).reading.id;
      await page
        .getByRole("button", {
          name: `Edit ${slot.label} reading`,
          exact: true,
        })
        .waitFor();
      await pause(2);
      await click(
        page.getByRole("button", { name: "Add reading", exact: true }),
      );
      await type(/Glucose value/, "128");
      await click(
        page.getByRole("button", { name: "Save reading", exact: true }),
      );
      await page.getByRole("alert").waitFor();
      await pause(2);
      await click(page.getByRole("button", { name: "Cancel", exact: true }));
    },
  );

  await scene(
    "Edit and delete",
    "Correct a reading, then delete it with confirmation. Reports update after every change.",
    18,
    async () => {
      await click(
        page.getByRole("button", {
          name: `Edit ${slot.label} reading`,
          exact: true,
        }),
      );
      await type(/Glucose value/, "130");
      await click(page.getByRole("button", { name: "Save changes" }));
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("button", {
          name: `Delete ${slot.label} reading`,
          exact: true,
        })
        .waitFor();
      await pause(3);
      await click(
        page.getByRole("button", {
          name: `Delete ${slot.label} reading`,
          exact: true,
        }),
      );
      await pause(2);
      await click(
        page.getByRole("button", { name: "Delete reading", exact: true }),
      );
      await page
        .getByRole("button", { name: `Add ${slot.label} reading`, exact: true })
        .waitFor();
      createdReading = null;
      const restored = await (
        await page.request.get(`${baseURL}/api/reports?date=${date}`)
      ).json();
      expect(restored.readings).toEqual(baseline.readings);
    },
  );

  await scene(
    "Daily and monthly reports",
    "See highest, lowest, one-decimal average and count for the selected day, month to date and previous full month.",
    20,
    async () => {
      await click(
        page.getByRole("button", { name: "Reports & trends", exact: true }),
      );
      await page.getByLabel("Report date").fill(today);
      await page.getByRole("article", { name: "Previous month" }).waitFor();
      await scroll(page.locator(".reports-section"));
      await pause(6);
      await page.getByLabel("Report date").fill("2026-10-15");
      await expect(
        page.getByRole("article", { name: "Previous month" }),
      ).toContainText("1 Sept – 30 Sept 2026");
      await scroll(page.locator(".reports-section"));
      await pause(4);
      await click(page.getByRole("button", { name: "Today", exact: true }));
      await scroll(page.locator(".reports-section"));
    },
  );

  await scene(
    "Monthly chart",
    "Explore daily averages over the month, with an accessible table of exact dates, averages and reading counts.",
    10,
    async () => {
      await scroll(page.locator(".trend-panel"));
      await page.getByRole("img", { name: /Line chart/ }).waitFor();
      await pause(3);
      await click(page.getByText("View chart data", { exact: true }));
      await scroll(
        page.getByRole("table", {
          name: "Monthly daily average glucose readings",
        }),
      );
      await pause(3);
      await click(page.getByText("View chart data", { exact: true }));
    },
  );

  await scene(
    "Paginated history",
    "Review saved readings in date order and move between pages. Each row supports editing and deletion.",
    12,
    async () => {
      await click(
        page.getByRole("button", { name: "My readings", exact: true }),
      );
      await page
        .getByRole("table", { name: "All your glucose readings" })
        .waitFor();
      await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
      await pause(4);
      await click(page.getByRole("button", { name: "Next", exact: true }));
      await expect(page.locator(".pagination")).toContainText("Page 2");
      await pause(3);
      await click(page.getByRole("button", { name: "Previous", exact: true }));
    },
  );

  await scene(
    "Patient privacy",
    "A newly registered patient starts with an empty journal and cannot see another patient’s readings.",
    16,
    async () => {
      await click(page.getByRole("button", { name: "Log out", exact: true }));
      await click(page.getByRole("button", { name: "Create an account" }));
      await type("Your name", "New Patient");
      const email = `walkthrough-${Date.now()}@example.test`;
      await type("Email address", email);
      await type("Password", "DemoRecording123!");
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/register") &&
          response.request().method() === "POST",
      );
      await click(
        page.getByRole("button", { name: "Create account", exact: true }),
      );
      const registered = await response;
      if (registered.status() !== 201)
        throw new Error(
          "The temporary walkthrough account could not be registered.",
        );
      createdUser = { id: (await registered.json()).user.id, email };
      await expect(
        page.getByRole("article", { name: "Daily report" }),
      ).toContainText("No readings just yet.");
    },
  );

  await scene(
    "Doctor workspace",
    "Doctors see read-only daily and monthly reports for assigned patients, with the same chart and date controls.",
    18,
    async () => {
      await click(page.getByRole("button", { name: "Log out", exact: true }));
      await login(
        process.env.DEMO_DOCTOR_EMAIL || "doctor@sweety.local",
        process.env.DEMO_DOCTOR_PASSWORD || "SweetyDoctor123!",
      );
      await page
        .getByRole("heading", { name: "Patient report summaries" })
        .waitFor();
      await expect(page.getByText("Read-only reports")).toBeVisible();
      await pause(5);
      await scroll(page.getByRole("table", { name: "Patient daily readings" }));
    },
  );

  await scene(
    "Live bonus verification",
    "Redis caches report results. BullMQ queues daily reminder logs, with no duplicate patient/day records.",
    14,
    async () => {
      const selected = await page.getByLabel("Assigned patient").inputValue();
      const reportURL = `${baseURL}/api/doctor/patients/${selected}/reports?date=${today}`;
      await page.request.get(reportURL);
      const cached = await page.request.get(reportURL);
      expect(cached.headers()["x-report-cache"]).toBe("HIT");
      const command = fileURLToPath(
        new URL("../server/scripts/reminders-run.js", import.meta.url),
      );
      const first = await execute(process.execPath, [command], {
        cwd: root,
        windowsHide: true,
        timeout: 30000,
      });
      const repeat = await execute(process.execPath, [command], {
        cwd: root,
        windowsHide: true,
        timeout: 30000,
      });
      const count = first.stdout.match(/(\d+) new daily logs/)[1];
      const duplicateCount = repeat.stdout.match(/(\d+) new daily logs/)[1];
      await page.evaluate(
        ({ count, duplicateCount }) => {
          const panel = document.createElement("section");
          panel.id = "walkthrough-proof";
          Object.assign(panel.style, {
            position: "fixed",
            inset: "90px 90px 160px",
            padding: "40px",
            zIndex: "2147483647",
            background: "#211b32",
            color: "#fff",
            borderRadius: "20px",
            boxShadow: "0 0 0 3000px #f7f5fce8",
            fontFamily: "system-ui",
          });
          const title = document.createElement("h2");
          title.textContent = "Live bonus checks";
          title.style.cssText = "font-size:32px;color:white;margin-bottom:12px";
          panel.append(title);
          const subtitle = document.createElement("p");
          subtitle.textContent =
            "Actual report headers and completed BullMQ jobs from this walkthrough.";
          subtitle.style.cssText =
            "font-size:18px;color:#c9bddf;margin-bottom:30px";
          panel.append(subtitle);
          const results = [
            ["Redis report cache", "X-Report-Cache: HIT"],
            ["BullMQ reminder job", `${count} new daily reminder logs`],
            ["Repeated daily job", `${duplicateCount} additional daily logs`],
          ];
          for (const [label, value] of results) {
            const row = document.createElement("div");
            row.style.cssText =
              "padding:22px 24px;background:#302740;border:1px solid #514160;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:20px;font-size:21px";
            const name = document.createElement("span");
            name.textContent = label;
            const result = document.createElement("strong");
            result.textContent = value;
            result.style.color = "#ceb6ff";
            row.append(name, result);
            panel.append(row);
          }
          const command = document.createElement("p");
          command.textContent =
            "Worker: npm run worker     ·     Trigger: npm run reminders:run";
          command.style.cssText =
            "font:16px monospace;color:#c9bddf;margin-top:30px";
          panel.append(command);
          document.body.append(panel);
        },
        { count, duplicateCount },
      );
    },
  );

  await scene(
    "Ready to review",
    "The repository includes setup instructions, environment examples, demo data, screenshots and 40 passing tests.",
    6,
    async () => {
      await page.evaluate(() =>
        document.getElementById("walkthrough-proof")?.remove(),
      );
      await scroll(page.locator(".trend-panel"));
      if (errors.length)
        throw new Error(
          `Browser errors during recording: ${errors.join("; ")}`,
        );
    },
  );
  if (!check) videoPath = await page.video().path();
} finally {
  await context.close();
  await browser.close();
  try {
    if (createdReading)
      await pool.query("DELETE FROM readings WHERE id=$1 AND user_id=$2", [
        createdReading,
        patientId,
      ]);
    if (createdUser)
      await pool.query("DELETE FROM users WHERE id=$1 AND email=$2", [
        createdUser.id,
        createdUser.email,
      ]);
  } finally {
    await pool.end();
  }
}

if (check) {
  console.log("Walkthrough rehearsal passed; temporary data was removed.");
} else {
  const first = cues[0].start;
  const duration = cues.at(-1).end - first;
  const subtitle = cues
    .map(
      (cue) =>
        `${clock(cue.start - first, true)} --> ${clock(cue.end - first, true)}\n${cue.title}\n${cue.text}`,
    )
    .join("\n\n");
  await writeFile(
    resolve(output, "sweety-demo.vtt"),
    `WEBVTT\n\n${subtitle}\n`,
  );
  const escape = (text) => text.replace(/[{}]/g, "").replace(/\r?\n/g, "\\N");
  const events = cues
    .map(
      (cue) =>
        `Dialogue: 0,${clock(cue.start - first)},${clock(cue.end - first)},Default,,0,0,0,,{\\fs17\\c&HEFA7BC&\\b1}${escape(cue.title.toUpperCase())}\\N{\\fs23\\c&HFFFFFF&\\b0}${escape(cue.text)}`,
    )
    .join("\n");
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1440\nPlayResY: 900\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,23,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,45,45,28,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events}\n`;
  await writeFile(resolve(temporary, "sweety-demo.ass"), ass);
  console.log("Encoding captioned MP4…");
  await execute(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      first.toFixed(3),
      "-i",
      videoPath,
      "-t",
      duration.toFixed(3),
      "-vf",
      "drawbox=x=0:y=ih-112:w=iw:h=112:color=0x211a32@0.96:t=fill,subtitles=sweety-demo.ass",
      "-r",
      "24",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      resolve(output, "sweety-demo.mp4"),
    ],
    { cwd: temporary, windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  console.log(
    `Saved docs/demo/sweety-demo.mp4 (${duration.toFixed(1)} seconds), with captions and no narration. Temporary demo data was restored.`,
  );
}
