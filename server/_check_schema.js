import { sql } from './db.js';
const rows = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inquiries'`;
console.table(rows);
process.exit(0);
