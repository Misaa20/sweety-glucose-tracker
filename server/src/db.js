import pg from "pg";

// Preserve date-only fields; converting them to JS Date can shift the calendar day.
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString) {
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
}
