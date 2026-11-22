import "../src/config.js";
import { before, beforeEach, after } from "node:test";
import supertest from "supertest";
import { createPool } from "../src/db.js";
import { createApp } from "../src/app.js";
import { migrate } from "../scripts/migrate.js";

export function testContext({ cache } = {}) {
  const url = process.env.TEST_DATABASE_URL;
  if (
    !url ||
    !/^[a-zA-Z_][a-zA-Z0-9_]*_test$/.test(
      decodeURIComponent(new URL(url).pathname.slice(1)),
    )
  ) {
    throw new Error(
      "Set TEST_DATABASE_URL to a dedicated database whose name ends in _test. Tests erase that database.",
    );
  }
  const pool = createPool(url);
  const config = {
    timezone: "Asia/Kolkata",
    clientOrigin: "http://localhost:5173",
    production: false,
  };
  const app = createApp(
    pool,
    config,
    { bcryptRounds: 4, rateLimitMax: 1000 },
    { cache },
  );
  before(async () => {
    await migrate(pool);
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE users RESTART IDENTITY CASCADE");
  });
  after(async () => {
    await pool.end();
  });
  const request = supertest(app);
  const agent = () => supertest.agent(app);
  const register = async (client, email = "era@example.com") =>
    client
      .post("/api/auth/register")
      .send({
        name: "Era",
        email,
        password: "SafePassword123!",
      })
      .expect(201);
  return { pool, request, agent, register, app, config };
}
