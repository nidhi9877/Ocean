import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function checkLocks() {
  try {
    console.log("Checking for locks...");
    const result = await sql`
      SELECT pid, state, query, wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' OR state = 'active';
    `;
    console.log("Active queries/locks:", result);
    
    // Also try to terminate stalled queries
    const terminate = await sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid() AND state = 'active';
    `;
    console.log("Terminated other active queries:", terminate);

  } catch (e) {
    console.error("Error:", e);
  }
}

checkLocks();
