# Sweety API reference

Development base URL: `http://localhost:3001/api`. The React app uses relative `/api` requests through Vite. Requests and responses use JSON, except successful delete/logout responses, which are empty.

## Authentication

`POST /auth/register`:

```json
{ "name": "Era", "email": "era@example.com", "password": "ChooseYourOwn123!" }
```

Returns `201` with `{ "user": { "id": 1, "name": "Era", "email": "era@example.com" } }` and sets a `sweety_session` cookie. Emails are trimmed and normalized to lowercase. Names are 1–100 characters; passwords are at least 8 characters and at most 72 UTF-8 bytes. Email uniqueness is enforced by PostgreSQL.

`POST /auth/login` accepts `email` and `password`, returning the same public user shape with `200`. Incorrect credentials return `401`; duplicate registration returns `409`. The register/login endpoints share a limit of 20 attempts per IP per 15-minute window and return `429` when exceeded.

`GET /auth/me` returns the current public user or `401` if unauthenticated/expired. `POST /auth/logout` deletes the server-side session and returns `204`.

The cookie is HttpOnly, SameSite=Strict and expires in seven days. It is also Secure in production. Each stored session contains only a SHA-256 hash of a cryptographically random token. Cross-origin mutation requests are rejected unless their Origin matches `CLIENT_ORIGIN`.

## Readings

Every reading/report request requires a valid session. The API gets the user ID from that session; providing another `user_id` has no effect.

### Create

`POST /readings`:

```json
{ "date": "2026-10-15", "slot": "after_lunch", "value": 123 }
```

Returns `201`:

```json
{
  "reading": {
    "id": 1,
    "date": "2026-10-15",
    "slot": "after_lunch",
    "value": 123,
    "created_at": "2026-10-15T09:00:00.000Z",
    "updated_at": "2026-10-15T09:00:00.000Z"
  }
}
```

Valid slots are `morning`, `after_breakfast`, `after_lunch` and `after_dinner`. Dates must be valid `YYYY-MM-DD` calendar dates on or after `1900-01-01`, and not after today in `APP_TIMEZONE`. Values must be whole numbers from 40 to 600. Digit-only strings are accepted and converted to numbers. A missing value, invalid date/slot or invalid value returns `400`.

Duplicate slots and a full day return `409`. The full-day message takes precedence when all four slots already exist. Edits exclude the reading itself from conflict checks, so a value correction still works on a full day.

### List and paginate

`GET /readings?page=1&limit=20&from=2026-10-01&to=2026-10-15`:

```json
{
  "readings": [
    {
      "id": 1,
      "date": "2026-10-15",
      "slot": "after_lunch",
      "value": 123,
      "created_at": "2026-10-15T09:00:00.000Z",
      "updated_at": "2026-10-15T09:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Defaults: page `1`, limit `20`. Limit must be 1–100; page must be 1–1,000,000. `from`/`to` are optional inclusive date filters. Results sort by date descending, then by the four slots in their natural daily order. Empty results return an empty array, total `0` and totalPages `0`; an out-of-range page returns an empty array with the real total.

### Edit and delete

`PUT /readings/:id` accepts the complete `date`, `slot`, `value` object and returns `200` with the updated reading. All create validation rules also apply to edits.

`DELETE /readings/:id` returns `204`. Editing or deleting a missing reading, including one belonging to another user, returns `404`.

## Reports

`GET /reports?date=2026-10-15` returns:

```json
{
  "date": "2026-10-15",
  "daily": {
    "start": "2026-10-15",
    "end": "2026-10-15",
    "count": 1,
    "highest": 123,
    "lowest": 123,
    "average": 123
  },
  "monthToDate": {
    "start": "2026-10-01",
    "end": "2026-10-15",
    "count": 1,
    "highest": 123,
    "lowest": 123,
    "average": 123
  },
  "monthly": {
    "start": "2026-09-01",
    "end": "2026-09-30",
    "count": 0,
    "highest": null,
    "lowest": null,
    "average": null
  },
  "readings": [
    { "id": 1, "date": "2026-10-15", "slot": "after_lunch", "value": 123 }
  ],
  "trend": [{ "date": "2026-10-15", "average": 123, "count": 1 }]
}
```

`date` defaults to today. Invalid or future dates return `400`. Summary boundaries are inclusive; `monthly` always means the complete previous calendar month. `readings` contains the selected day's readings in slot order. `trend` contains recorded days from the entire selected month, with that day's average and count. JSON numbers do not retain a trailing `.0`; the UI formats every average with one decimal place.

## Errors

```json
{
  "message": "Value must be a whole number between 40 and 600 mg/dl.",
  "errors": {
    "value": "Value must be a whole number between 40 and 600 mg/dl."
  }
}
```

`errors` is optional and maps validation failures to form fields. All errors include a human-readable `message`.

| Status | Meaning                                                              |
| ------ | -------------------------------------------------------------------- |
| `400`  | Invalid input, malformed JSON or query parameters.                   |
| `401`  | Missing/expired session or incorrect login.                          |
| `403`  | Mutation from an unapproved browser origin.                          |
| `404`  | Unknown endpoint or inaccessible reading.                            |
| `409`  | Duplicate email, occupied slot or daily limit.                       |
| `413`  | Request exceeds the 16 KB body limit.                                |
| `429`  | Too many authentication attempts.                                    |
| `500`  | Unexpected server/database error; internal details are not returned. |

## Metadata and health

`GET /meta` is public and returns `{ "today": "2026-10-15", "timezone": "Asia/Kolkata" }` for the server's current date. `GET /health` returns `{ "status": "ok" }` after a successful database query.
