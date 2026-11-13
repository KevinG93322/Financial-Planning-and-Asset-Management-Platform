import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDir = path.join(root, "data", "pg");
const port = 55432;
const user = "fp";
const password = "fp";
const database = "financial_platform";

const imported = await import("embedded-postgres");
const EmbeddedPostgres = imported.default;

fs.mkdirSync(databaseDir, { recursive: true });

const postgres = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
});

try {
  await postgres.initialise();
  console.log("Initialised a local PostgreSQL data directory.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/already|exist/i.test(message)) throw error;
  console.log("Using the existing local PostgreSQL data directory.");
}

await postgres.start();
console.log(`PostgreSQL listening on 127.0.0.1:${port}`);

try {
  await postgres.createDatabase(database);
  console.log(`Created database ${database}.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/already exists/i.test(message)) throw error;
  console.log(`Database ${database} is already present.`);
}

console.log("PostgreSQL is ready");

async function shutdown() {
  await postgres.stop();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

await new Promise(() => {});
