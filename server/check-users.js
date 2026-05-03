import {sql} from './db.js';

async function check() {
  try {
    const users = await sql`SELECT id, username, role, password_hash FROM users LIMIT 10`;
    console.log(users);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
