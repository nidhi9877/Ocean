import { sql } from './db.js';
import bcrypt from 'bcryptjs';

async function alterDb() {
  try {
    console.log('Adding status column to providers...');
    await sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'approved';`;
    
    console.log('Checking for management user...');
    const existing = await sql`SELECT id FROM users WHERE username = 'admin_management'`;
    if (existing.length === 0) {
      console.log('Creating management user...');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('Management@123', salt);
      await sql`INSERT INTO users (username, password_hash, role) VALUES ('admin_management', ${hash}, 'management')`;
      console.log('Inserted admin_management user.');
    } else {
      console.log('admin_management user already exists.');
    }
    
    console.log('Successfully altered database!');
  } catch (error) {
    console.error('Error altering database:', error);
  } finally {
    process.exit(0);
  }
}

alterDb();
