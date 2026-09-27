/**
 * CLI entry of `pnpm db:seed`: inserts the demo user and todos. Refuses to run in production.
 *
 * `pnpm db:seed` 的入口：写入演示用户和待办。`NODE_ENV=production` 时拒绝运行。
 */
import { createDb } from "../client.js";
import { resolveDatabaseUrl } from "../env.js";
import { DEMO_USER, seedDemoData } from "../seed.js";

if (process.env.NODE_ENV === "production") {
  process.stderr.write("Refusing to seed demo data with NODE_ENV=production.\n");
  process.exit(1);
}

const { db, close } = createDb(resolveDatabaseUrl(), { maxConnections: 1 });
try {
  await seedDemoData(db);
  process.stdout.write(`Seeded demo user ${DEMO_USER.email}.\n`);
} finally {
  await close();
}
