import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var apfPool: Pool | undefined;
}

export const pool =
  global.apfPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global.apfPool = pool;
}
