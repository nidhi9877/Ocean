import { initDatabase } from './db.js';

async function test() {
  console.log("Starting initDatabase...");
  const start = Date.now();
  await initDatabase();
  console.log("Done in", (Date.now() - start) / 1000, "seconds");
}

test().catch(console.error);
