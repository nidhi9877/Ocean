import { sql } from './db.js';
async function run() {
  await sql`UPDATE providers SET status = 'approved' WHERE status = 'pending'`;
  console.log('Done');
  process.exit(0);
}
run();
