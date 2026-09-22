import { sql } from './server/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function run() {
  const providers = await sql`SELECT p.company_name, u.username FROM providers p JOIN users u ON p.user_id = u.id`;
  console.log('Providers:', providers);
  process.exit(0);
}
run();
