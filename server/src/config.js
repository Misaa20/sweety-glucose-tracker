import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export function getConfig() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy .env.example to .env first.');
  const timezone = process.env.APP_TIMEZONE || 'Asia/Kolkata';
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  return {
    databaseUrl: process.env.DATABASE_URL,
    port: Number(process.env.PORT || 3001),
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    timezone,
    production: process.env.NODE_ENV === 'production',
  };
}
