import { getConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';

const config = getConfig();
const pool = createPool(config.databaseUrl);
await pool.query('SELECT 1');
const server = createApp(pool, config).listen(config.port, () => {
  console.log(`Sweety API listening at http://localhost:${config.port}`);
});
pool.on('error', (error) => console.error('Database connection error:', error.message));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => { await pool.end(); process.exit(0); });
  });
}
