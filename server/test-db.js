import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function test() {
  try {
    console.log("Testing connection...");
    const result = await sql`SELECT 1 as x`;
    console.log("Success:", result);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
