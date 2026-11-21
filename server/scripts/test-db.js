import '../src/config.js';
import { createPool } from '../src/db.js';
import { migrate } from './migrate.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required.');
const parsed = new URL(url);
const database = decodeURIComponent(parsed.pathname.slice(1));
if (!/^[a-zA-Z_][a-zA-Z0-9_]*_test$/.test(database)) throw new Error('Test database name must end in _test.');
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const admin = createPool(adminUrl.href);
try {
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) {
    // Identifier is restricted by the pattern above; all other queries use parameters.
    await admin.query(`CREATE DATABASE "${database}"`);
  }
} finally { await admin.end(); }
const pool = createPool(url);
try { await migrate(pool); console.log('Test database ready.'); } finally { await pool.end(); }
