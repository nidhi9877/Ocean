import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function fixTimezones() {
  try {
    console.log('Fixing timezone on inquiries.created_at...');
    await sql`ALTER TABLE inquiries ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`;
    console.log('Fixed inquiries!');
  } catch (e) {
    console.log('Error inquiries: ', e.message);
  }
}

fixTimezones();
