export function createReportCache(
  redis,
  { prefix = "sweety:reports", ttl = 300 } = {},
) {
  const patientPrefix = (id) => `${prefix}:patient:${id}:`;
  const key = (id, version, date) =>
    `${patientPrefix(id)}v:${version}:date:${date}`;
  return {
    available: () => redis?.status === "ready",
    async get(id, version, date) {
      if (redis?.status !== "ready") return null;
      try {
        const value = await redis.get(key(id, version, date));
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    },
    async set(id, version, date, report) {
      if (redis?.status !== "ready") return;
      try {
        await redis.set(
          key(id, version, date),
          JSON.stringify(report),
          "EX",
          ttl,
        );
      } catch {
        /* Caching is optional; the report is already computed. */
      }
    },
    async invalidate(id) {
      if (redis?.status !== "ready") return;
      try {
        let cursor = "0";
        do {
          const [next, keys] = await redis.scan(
            cursor,
            "MATCH",
            `${patientPrefix(id)}*`,
            "COUNT",
            100,
          );
          cursor = next;
          if (keys.length) await redis.del(...keys);
        } while (cursor !== "0");
      } catch {
        /* The database revision still makes old keys unreachable. */
      }
    },
  };
}
