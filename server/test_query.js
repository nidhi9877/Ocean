import { sql } from './db.js';

async function run() {
  const products = await sql`SELECT * FROM products`;
  console.log(products);
}

run().catch(console.error);
