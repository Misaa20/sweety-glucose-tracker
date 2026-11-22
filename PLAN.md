# Sweety implementation plan

Build a small, readable JavaScript app with React (Vite), Express and PostgreSQL.
The assignment says MERN but explicitly requires PostgreSQL, so PostgreSQL replaces MongoDB.

## Milestones

1. **Foundation:** npm workspaces, shared validation, SQL migrations, environment examples,
   PostgreSQL Docker service, and this plan.
2. **API:** bcrypt registration/login, database-backed cookie sessions, ownership filtering,
   validated reading CRUD, pagination and all three reports. Use parameterized SQL,
   unique constraints and transactions to protect concurrent reading submissions.
3. **Frontend:** responsive dashboard, registration/login, reading create/edit/delete,
   clear validation feedback, report date selector, empty states and month chart.
4. **Verification:** real PostgreSQL integration tests, React Testing Library form tests,
   browser flows, responsive screenshots and a production build.
5. **Handoff:** repeatable demo seed, complete README, API documentation, full-app Docker
   setup, CI, screenshots and regular Git commits. The user owns Git commits and pushes
   to `https://github.com/Misaa20/sweety-glucose-tracker`; provide commit commands at checkpoints.

## Required acceptance checklist

- [x] Name/email/password registration and login; bcrypt hashes; user-isolated data.
- [x] Add/list/edit/delete date + one of four slots + integer glucose readings.
- [x] Required value; integer 40–600; one reading per slot/day; four/day; no future dates.
- [x] Daily report with slot list, highest/lowest/average (one decimal) and count.
- [x] Month-to-date: first of selected month through selected date, inclusive.
- [x] Monthly: full calendar month preceding selected date, including year rollover.
- [x] Friendly report empty states and useful UI errors.
- [x] README install/database/server/client/tests/assumptions/improvements instructions.
- [x] Environment example, demo seed, screenshots and incremental commits.

## Optional bonuses

- [x] Paginated `GET /api/readings?page=1&limit=20`.
- [x] Monthly reading chart.
- [x] Docker Compose for PostgreSQL and the complete application.
- [x] React Testing Library tests for the reading form.

- [x] Redis report caching with invalidation, revision protection and outage fallback.
- [x] BullMQ daily reminder worker with persistent, idempotent patient/day logs.
- [x] Doctor accounts and read-only assigned-patient reports, demo seed and assignment script.

All seven bonus tasks follow the completed required patient workflow.
No AI integration is requested by the product brief.
