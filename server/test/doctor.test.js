import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { testContext } from "./helpers.js";

describe("Doctor authorization and assigned-patient reports", () => {
  const { pool, request, agent, register } = testContext();
  async function doctor(email = "doctor@example.com") {
    const client = agent();
    const {
      body: { user },
    } = await register(client, email);
    await pool.query("UPDATE users SET role='doctor' WHERE id=$1", [user.id]);
    return { client, id: user.id };
  }

  it("requires authentication and prevents public registration from granting doctor access", async () => {
    await request.get("/api/doctor/patients").expect(401);
    const client = agent();
    const { body } = await client
      .post("/api/auth/register")
      .send({
        name: "Patient",
        email: "patient@example.com",
        password: "SafePassword123!",
        role: "doctor",
      })
      .expect(201);
    assert.equal(body.user.role, "patient");
    await client.get("/api/doctor/patients").expect(403);
    await client.get("/api/doctor/patients/1/reports").expect(403);
  });

  it("lists only assigned patients and provides all reports with no patient mutation permission", async () => {
    const { client, id } = await doctor();
    const patient = agent();
    const {
      body: { user },
    } = await register(patient, "patient@example.com");
    const {
      body: { user: unassigned },
    } = await register(agent(), "unassigned@example.com");
    await pool.query(
      "INSERT INTO doctor_patients(doctor_id,patient_id) VALUES($1,$2)",
      [id, user.id],
    );
    const reading = await patient
      .post("/api/readings")
      .send({ date: "2026-01-10", slot: "morning", value: 123 })
      .expect(201);
    const list = await client.get("/api/doctor/patients").expect(200);
    assert.deepEqual(
      list.body.patients.map((patient) => patient.id),
      [user.id],
    );
    const report = await client
      .get(`/api/doctor/patients/${user.id}/reports?date=2026-01-10`)
      .expect(200);
    assert.equal(report.body.patient.id, user.id);
    assert.equal(report.body.daily.average, 123);
    assert.equal(report.body.monthToDate.count, 1);
    assert.equal(report.body.monthly.count, 0);
    assert.equal(report.body.readings[0].slot, "morning");
    await client
      .get(`/api/doctor/patients/${unassigned.id}/reports`)
      .expect(404);
    await client.get("/api/readings").expect(403);
    await client.get("/api/reports").expect(403);
    await client
      .post("/api/readings")
      .send({ date: "2026-01-10", slot: "morning", value: 100 })
      .expect(403);
    await client
      .put(`/api/readings/${reading.body.reading.id}`)
      .send({ date: "2026-01-10", slot: "morning", value: 200 })
      .expect(403);
    await client.delete(`/api/readings/${reading.body.reading.id}`).expect(403);
    assert.equal(
      (await patient.get("/api/readings")).body.readings[0].value,
      123,
    );
  });

  it("rechecks assignments and roles from PostgreSQL, and validates patient IDs and dates", async () => {
    const { client, id } = await doctor();
    const {
      body: { user },
    } = await register(agent());
    await pool.query(
      "INSERT INTO doctor_patients(doctor_id,patient_id) VALUES($1,$2)",
      [id, user.id],
    );
    const login = await client
      .post("/api/auth/login")
      .send({ email: "doctor@example.com", password: "SafePassword123!" })
      .expect(200);
    assert.equal(login.body.user.role, "doctor");
    assert.equal((await client.get("/api/auth/me")).body.user.role, "doctor");
    await client.get("/api/doctor/patients/invalid/reports").expect(400);
    await client
      .get("/api/doctor/patients/9999999999999999/reports")
      .expect(400);
    await client
      .get(`/api/doctor/patients/${user.id}/reports?date=2999-01-01`)
      .expect(400);
    await client
      .get(`/api/doctor/patients/${user.id}/reports?date=2026-02-30`)
      .expect(400);
    await pool.query("DELETE FROM doctor_patients WHERE doctor_id=$1", [id]);
    await client.get(`/api/doctor/patients/${user.id}/reports`).expect(404);
    assert.deepEqual(
      (await client.get("/api/doctor/patients")).body.patients,
      [],
    );
    await pool.query("UPDATE users SET role='patient' WHERE id=$1", [id]);
    await client.get("/api/doctor/patients").expect(403);
  });

  it("enforces doctor/patient roles on assignment inserts in the database", async () => {
    const { id } = await doctor();
    const { id: secondDoctor } = await doctor("another-doctor@example.com");
    const {
      body: { user },
    } = await register(agent());
    await assert.rejects(
      pool.query(
        "INSERT INTO doctor_patients(doctor_id,patient_id) VALUES($1,$2)",
        [id, secondDoctor],
      ),
      { code: "23514" },
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO doctor_patients(doctor_id,patient_id) VALUES($1,$2)",
        [user.id, id],
      ),
      { code: "23514" },
    );
  });
});
