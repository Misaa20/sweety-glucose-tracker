import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { HttpError, validateBody } from './errors.js';

const COOKIE = 'sweety_session';
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export function createAuth(pool, config, { bcryptRounds = 12, rateLimitMax = 20 } = {}) {
  const router = Router();
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: config.production, path: '/' };
  const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), bcryptRounds);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  });

  async function startSession(req, res, user) {
    const token = randomBytes(32).toString('hex');
    // Replace any session held by this browser and prune expired sessions.
    await pool.query('DELETE FROM sessions WHERE expires_at <= NOW() OR token_hash = $1', [
      tokenHash(typeof req.cookies[COOKIE] === 'string' ? req.cookies[COOKIE] : ''),
    ]);
    await pool.query('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1,$2,$3)', [
      tokenHash(token), user.id, new Date(Date.now() + SESSION_AGE),
    ]);
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE });
  }

  async function requireUser(req, res, next) {
    const token = req.cookies[COOKIE];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, 'Please log in to continue.');
    const { rows: [user] } = await pool.query(
      `SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at > NOW()`, [tokenHash(token)],
    );
    if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');
    req.user = user;
    next();
  }

  function credentials(body, registering = false) {
    const { name, email, password } = body ?? {};
    const errors = {};
    if (registering && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
      errors.name = 'Please enter your name (1–100 characters).';
    }
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      errors.password = 'Password must be at least 8 characters and no more than 72 bytes.';
    }
    validateBody(errors);
    return { name: name?.trim(), email: email.trim().toLowerCase(), password };
  }

  router.post('/register', limiter, async (req, res) => {
    const { name, email, password } = credentials(req.body, true);
    const hash = await bcrypt.hash(password, bcryptRounds);
    let user;
    try {
      ({ rows: [user] } = await pool.query(
        'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email', [name, email, hash],
      ));
    } catch (error) {
      if (error.code === '23505') throw new HttpError(409, 'An account with this email already exists.', { email: 'An account with this email already exists.' });
      throw error;
    }
    await startSession(req, res, user);
    res.status(201).json({ user });
  });

  router.post('/login', limiter, async (req, res) => {
    const { email, password } = credentials(req.body);
    const { rows: [user] } = await pool.query('SELECT id,name,email,password_hash FROM users WHERE email=$1', [email]);
    const valid = await bcrypt.compare(password, user?.password_hash || await dummyHash);
    if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
    const publicUser = { id: user.id, name: user.name, email: user.email };
    await startSession(req, res, publicUser);
    res.json({ user: publicUser });
  });

  router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));
  router.post('/logout', async (req, res) => {
    const token = req.cookies[COOKIE];
    if (typeof token === 'string') await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
    res.clearCookie(COOKIE, cookieOptions);
    res.status(204).end();
  });

  return { router, requireUser };
}
