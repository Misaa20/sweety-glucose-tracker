import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { testContext } from './helpers.js';

describe('Authentication with PostgreSQL', () => {
  const { pool, request, agent, register } = testContext();

  it('registers, normalizes email, hashes passwords, and persists a private session', async () => {
    const client = agent();
    const response = await register(client, 'ERA@Example.com');
    assert.equal(response.body.user.email, 'era@example.com');
    assert.equal(response.body.user.password_hash, undefined);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Strict/);
    const { rows: [user] } = await pool.query('SELECT * FROM users');
    assert.notEqual(user.password_hash, 'SafePassword123!');
    assert.equal(await bcrypt.compare('SafePassword123!', user.password_hash), true);
    const { rows: [session] } = await pool.query('SELECT * FROM sessions');
    assert.equal(session.token_hash.length, 64);
    assert.ok(!response.headers['set-cookie'][0].includes(session.token_hash));
    await client.get('/api/auth/me').expect(200);
    await request.get('/api/auth/me').expect(401);
  });

  it('logs in and invalidates the server-side session on logout', async () => {
    const client = agent();
    await register(client);
    await client.post('/api/auth/logout').expect(204);
    await client.get('/api/auth/me').expect(401);
    const login = await client.post('/api/auth/login').send({ email: 'era@example.com', password: 'SafePassword123!' }).expect(200);
    const stolenCookie = login.headers['set-cookie'][0].split(';')[0];
    await client.post('/api/auth/logout').expect(204);
    await request.get('/api/auth/me').set('Cookie', stolenCookie).expect(401);
  });

  it('rejects duplicate emails, invalid registration and wrong credentials', async () => {
    await register(agent());
    await request.post('/api/auth/register').send({ name: 'Other', email: 'ERA@example.com', password: 'Password123!' }).expect(409);
    const invalid = await request.post('/api/auth/register').send({ name: '', email: 'bad', password: 'short' }).expect(400);
    assert.deepEqual(Object.keys(invalid.body.errors), ['name', 'email', 'password']);
    await request.post('/api/auth/register').send({ name: 'Era', email: 'valid@example.com', password: '🙂'.repeat(20) }).expect(400);
    await request.post('/api/auth/login').send({ email: 'era@example.com', password: 'WrongPassword123!' }).expect(401);
    await request.post('/api/auth/login').send({ email: 'missing@example.com', password: 'WrongPassword123!' }).expect(401);
    // Unused fields must not turn otherwise valid login requests into server errors.
    await request.post('/api/auth/login').send({ name: {}, email: 'era@example.com', password: 'SafePassword123!' }).expect(200);
  });

  it('rejects expired sessions and cross-origin mutation requests', async () => {
    const client = agent();
    await register(client);
    await pool.query("UPDATE sessions SET expires_at=NOW() - INTERVAL '1 minute'");
    await client.get('/api/auth/me').expect(401);
    await request.post('/api/auth/login').set('Origin', 'https://untrusted.example').send({}).expect(403);
  });
});
