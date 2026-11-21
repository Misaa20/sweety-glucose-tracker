# Sweety — Blood Glucose Tracker

A small full-stack JavaScript app for recording up to four glucose readings a day and viewing daily and monthly reports. Built for the Kenpath Junior Full Stack Developer assignment with **React, Node.js, Express and PostgreSQL**.

![Sweety dashboard](docs/screenshots/dashboard.png)

## Features

- Register with a name, email and password; log in and log out.
- Passwords are hashed with bcrypt. Database-backed sessions use HttpOnly, SameSite cookies; raw session tokens are not stored in the database.
- Each patient sees and changes only their own readings and reports.
- Create, view, edit and delete readings, including corrections to the date and slot.
- Four slots: **Morning (fasting), After breakfast, After lunch, After dinner**.
- Clear form and API errors for a missing value, a non-integer or value outside **40–600 mg/dl**, a future date, an occupied slot or a fifth daily reading.
- Daily, month-to-date and previous-month reports with highest, lowest, average to one decimal and number of readings. Daily slot cards list every reading. Empty reports show a friendly message.
- Responsive dashboard, accessible form labels, keyboard-accessible dialogs, loading/error states and delete confirmation.

**Optional bonuses included:** paginated reading history, a monthly line chart of daily averages with an accessible data table, Docker Compose for the database and app, and React Testing Library form tests. Redis, BullMQ and doctor accounts were not selected.

## Requirements

- Node.js **22.12 or newer** (Node 22 is used by Docker and CI).
- npm with workspace support; install dependencies once from the repository root.
- Docker Desktop / Docker Engine with Compose, or an existing PostgreSQL **17** database.

## Quick start

Clone the repository and enter it:

```bash
git clone https://github.com/Misaa20/sweety-glucose-tracker.git
cd sweety-glucose-tracker
npm ci
```

Copy the environment example. In PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Start PostgreSQL, apply migrations and create the demo data:

```bash
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:5173**. Vite forwards `/api` to Express, keeping cookie authentication on the same origin.

| Demo login | Value               |
| ---------- | ------------------- |
| Email      | `demo@sweety.local` |
| Password   | `SweetyDemo123!`    |

These are public demo credentials, not production secrets. You can also create a new account to start with an empty journal.

The seed creates readings from the start of the previous month through today, with three slots filled today. It preserves existing readings and resets only the demo account's name/password to the configured seed values. Re-running it does not duplicate readings.

## Run server and client separately

Run these commands in two terminals, from the repository root:

```bash
# Terminal 1: API, default http://localhost:3001
npm run dev -w server

# Terminal 2: React, http://localhost:5173
npm run dev -w client
```

`npm run dev` starts both together. For the built app without the Vite dev server:

```bash
npm run build
npm start
```

Open **http://localhost:3001** and set `CLIENT_ORIGIN=http://localhost:3001` in `.env` before starting the built app. Express serves both the compiled frontend and `/api`.

## Database setup

The default development database is available at `localhost:5434`. This avoids a common conflict with an existing PostgreSQL on port 5432. The Docker volume `sweety_data` persists the data.

If using your own PostgreSQL installation, create a database and set `DATABASE_URL` in `.env` to its connection URL, then run `npm run db:migrate`. Migration SQL lives in `server/migrations`; a `schema_migrations` table tracks applied migrations. Migrations are transactional and safe to re-run.

The schema has three application tables:

- `users`: normalized unique email, name, bcrypt password hash.
- `sessions`: SHA-256 session token hash, user and expiry.
- `readings`: user, date-only field, slot, integer value, creation/update timestamps.

PostgreSQL checks restrict slots and values. A unique `(user_id, date, slot)` constraint means at most one reading per slot and, with four legal slots, at most four per day. A transaction locks the user's row during mutations so simultaneous submissions get correct validation. Queries use bound parameters and derive the user ID from the session, ignoring any supplied `user_id`.

## Tests

Create and migrate a dedicated test database once:

```bash
npm run db:test:setup
npm test
```

`TEST_DATABASE_URL` must name a database ending in `_test`. API tests truncate its application data between cases; they never use `DATABASE_URL` for this cleanup. The setup script needs a PostgreSQL role with permission to create the test database. If you do not have that permission, have the database created separately, then set `TEST_DATABASE_URL`; the script will migrate the existing database.

Individual suites:

```bash
npm run test:api
npm run test:client
```

- **13 API integration tests** use real PostgreSQL and Supertest. They cover bcrypt/session lifecycle, validation boundaries, user isolation, duplicate/concurrent submissions, edits/deletes, pagination, report averages, inclusive date ranges, leap years and January rollover.
- **9 frontend tests** use React Testing Library and Vitest. They cover authentication feedback, reading validation, edits, server conflicts, double submission prevention, one-decimal averages and report empty states.

Run the desktop and mobile browser journeys:

```bash
npx playwright install chromium
npm run db:migrate
npm run test:e2e
```

Playwright starts the dev servers automatically if they are not already running. Its two browser tests cover registration, validation, all reading operations, report navigation, session persistence, logout/login and patient isolation. These browser journeys create disposable `@example.test` accounts in the local development database. They do not alter the demo user's readings. Run `npm test` and browser tests sequentially.

The GitHub Actions workflow provisions PostgreSQL and runs the API/frontend tests, production build and both browser journeys on a push or pull request. A local passing run does not establish the status of a future GitHub Actions run.

## Full app with Docker

Stop any local Express process using port 3001 first, then run:

```bash
docker compose up --build -d --wait
docker compose exec app node server/scripts/seed.js
```

Open **http://localhost:3001**. The app container applies migrations before starting Express and serves the compiled React app. Docker runs the application as a non-root user. PostgreSQL readiness and app health are checked.

To use another host port, change both `DOCKER_APP_PORT` and `DOCKER_CLIENT_ORIGIN` in `.env`. For example, use `3002` and `http://localhost:3002`. `POSTGRES_PORT` controls only the database's host port; the app container connects to `db:5432`.

To stop containers while preserving readings:

```bash
docker compose down
```

This Compose configuration is for local HTTP development and overrides `NODE_ENV` to `development`. For an HTTPS deployment, use `NODE_ENV=production` to enable Secure session cookies, set `CLIENT_ORIGIN` to the exact public origin and supply your own database credentials. Keep `.env` outside Git.

## Environment variables

All supported application variables are listed in the root [`.env.example`](.env.example). No frontend API key or other service credential is needed.

| Variable                                            | Purpose                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                      | PostgreSQL URL for the API, migrations and demo seed.                                                                |
| `TEST_DATABASE_URL`                                 | Dedicated PostgreSQL test database; name must end in `_test`.                                                        |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL container credentials/database, also used to form the app container's URL. Defaults are development-only. |
| `POSTGRES_PORT`                                     | Host PostgreSQL port; default `5434`. Keep the port in local database URLs consistent.                               |
| `PORT`                                              | Express port; default `3001`. Vite reads this from the root environment for its API proxy.                           |
| `CLIENT_ORIGIN`                                     | Exact allowed browser origin, e.g. `http://localhost:5173` for Vite.                                                 |
| `APP_TIMEZONE`                                      | IANA timezone for the meaning of today; default `Asia/Kolkata`.                                                      |
| `NODE_ENV`                                          | `development` locally; `production` enables Secure session cookies.                                                  |
| `DOCKER_APP_PORT`                                   | App container's exposed host port; default `3001`.                                                                   |
| `DOCKER_CLIENT_ORIGIN`                              | Browser origin used by the Docker app; default `http://localhost:3001`.                                              |
| `DEMO_EMAIL`, `DEMO_PASSWORD`                       | Optional overrides for demo seed credentials and screenshot login.                                                   |

## Report definitions

All boundaries are inclusive. The selected date controls all three summaries:

| Report         | Start                             | End                              | Example for 15 Oct 2026 |
| -------------- | --------------------------------- | -------------------------------- | ----------------------- |
| Daily          | Selected date                     | Selected date                    | 15 Oct 2026             |
| Month to date  | First day of selected month       | Selected date                    | 1–15 Oct 2026           |
| Previous month | First day of prior calendar month | Last day of prior calendar month | 1–30 Sep 2026           |

Each summary includes the minimum, maximum, average and count. Average is rounded by PostgreSQL to one decimal and always displayed with one decimal in the UI. Empty summaries have count `0` and `null` statistics; the UI displays a friendly message. Reports and chart data are read from one consistent database snapshot.

The chart shows daily averages for the entire selected month, combining that day's recorded slots. It can include readings after the selected report date within the same month; the month-to-date report always stops at the selected date. An expandable data table gives the exact dates, averages and counts.

## API

All endpoints use `/api`. Authentication uses the session cookie; no bearer token is needed. See [the API reference](docs/API.md) for request/response examples and pagination.

| Method   | Endpoint                    | Purpose                                                   |
| -------- | --------------------------- | --------------------------------------------------------- |
| `POST`   | `/auth/register`            | Create an account and session.                            |
| `POST`   | `/auth/login`               | Log in and create a session.                              |
| `GET`    | `/auth/me`                  | Get the current patient.                                  |
| `POST`   | `/auth/logout`              | Invalidate the session and clear its cookie.              |
| `GET`    | `/readings?page=1&limit=20` | Paginated readings; optional `from`/`to` filters.         |
| `POST`   | `/readings`                 | Add a reading.                                            |
| `PUT`    | `/readings/:id`             | Edit its date, slot and value.                            |
| `DELETE` | `/readings/:id`             | Delete a reading.                                         |
| `GET`    | `/reports?date=2026-10-15`  | All three summaries, daily readings and month chart data. |
| `GET`    | `/meta`                     | Current app date and timezone.                            |
| `GET`    | `/health`                   | API/database readiness.                                   |

## Project layout

```text
client/src/
  components/       Authentication, forms, reading cards, reports, chart, journal
  test/             React Testing Library tests
  App.jsx           Session bootstrap and authentication state
  Dashboard.jsx     Navigation, data fetching and reading actions
server/
  src/              Express app, authentication, readings, reports, database config
  migrations/       Versioned PostgreSQL schema
  scripts/          Migration, demo seed and test database setup
  test/             Real PostgreSQL API integration tests
shared/             Slot definitions, calendar helpers and reading validation
e2e/                Playwright desktop/mobile patient journey
docs/               API reference, demo walkthrough and screenshots
scripts/            Screenshot capture helper
```

## Screenshots and demo

Real screenshots from the running application are included:

- [Login](docs/screenshots/login.png)
- [Dashboard](docs/screenshots/dashboard.png)
- [Add/edit reading form](docs/screenshots/reading-form.png)
- [Reports](docs/screenshots/reports.png)
- [Paginated history](docs/screenshots/history.png)
- [Mobile dashboard](docs/screenshots/mobile.png)

To regenerate them, seed the demo account and leave `npm run dev` running in another terminal, then run:

```bash
npm run screenshots
```

The screenshot command needs the Playwright Chromium browser installed. Screenshots satisfy the assignment's “screenshots or short recording” requirement; a recording is optional. A [2–3 minute walkthrough](docs/DEMO.md) is included if you want to record one.

## Notes

**Assumptions:** PostgreSQL replaces MongoDB because the brief explicitly requires PostgreSQL. Dates are calendar dates in a single configured timezone, defaulting to India; future-date validation uses the server's calendar. The selected date anchors the previous-month report. All four slots are available for every past date, with no restriction to a specific time of day. New accounts start empty. Passwords must have at least 8 characters and at most 72 UTF-8 bytes, respecting bcrypt's limit. Sessions expire after seven days. AI features are not part of the app requirements.

**With more time:** add password reset/email verification, per-user timezone preferences, CSV export, deployment monitoring, stronger operational session/rate-limit cleanup, broader browser coverage and an automated database backup workflow. Redis caching, background reminders and assigned doctor accounts would be separate features after the required patient workflow.
