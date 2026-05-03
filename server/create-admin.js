import {sql} from './db.js';
import bcrypt from 'bcryptjs';

async function check() {
  try {
    const username = 'testuser_demo';
    const password = 'Password@123';
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO users (username, password_hash, role)
        VALUES (${username}, ${passwordHash}, 'buyer')
      `;
      console.log('Created user testuser_demo / Password@123');
    } else {
      await sql`UPDATE users SET password_hash = ${passwordHash} WHERE username = ${username}`;
      console.log('Updated password for testuser_demo / Password@123');
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
