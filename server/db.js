import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

export async function initDatabase() {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'buyer',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create providers table
    await sql`
      CREATE TABLE IF NOT EXISTS providers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100),
        country VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create buyers table
    await sql`
      CREATE TABLE IF NOT EXISTS buyers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        imo_number VARCHAR(100) NOT NULL,
        ship_name VARCHAR(255) NOT NULL,
        ship_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create products table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
        product_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        brand VARCHAR(100),
        model_number VARCHAR(100),
        part_number VARCHAR(100),
        manufactured_at VARCHAR(255),
        location VARCHAR(255),
        price DECIMAL(10,2) NOT NULL,
        quantity INTEGER DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create inquiries table
    await sql`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE,
        provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        destination_location VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Ensure we add the extra columns for an existing DB without wiping data
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100)`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS model_number VARCHAR(100)`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS manufactured_at VARCHAR(255)`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(255)`;
      await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`;
    } catch (e) {
      console.log('Columns likely already exist or minor error:', e.message);
    }

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}

export { sql };
