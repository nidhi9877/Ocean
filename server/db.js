import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

export async function initDatabase() {
  try {
    const start = Date.now();
    console.log('⏳ Initializing database tables...');

    // Execute CREATE TABLE sequentially due to foreign key dependencies
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'buyer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

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
        payment_mode VARCHAR(50) DEFAULT 'pre-payment/credit',
        status VARCHAR(50) DEFAULT 'approved',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS buyers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        imo_number VARCHAR(100) NOT NULL,
        ship_name VARCHAR(255) NOT NULL,
        ship_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

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
        additional_info TEXT,
        media_link TEXT,
        service_type VARCHAR(50) DEFAULT 'Supply',
        payment_mode VARCHAR(50) DEFAULT 'pre-payment/credit',
        department VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE,
        provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        destination_location VARCHAR(255) NOT NULL,
        target_price DECIMAL(10,2),
        surge_email_sent BOOLEAN DEFAULT FALSE,
        broadcast_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        cc VARCHAR(255),
        bcc VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS buyer_searches (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        search_query VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_buyer_product_search UNIQUE (buyer_id, product_id)
      )
    `;

    // Execute ALTER TABLE in parallel
    try {
      await Promise.all([
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100)`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS model_number VARCHAR(100)`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS manufactured_at VARCHAR(255)`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(255)`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_info TEXT`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS media_link TEXT`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'Supply'`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'pre-payment/credit'`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS department VARCHAR(255)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS target_price DECIMAL(10,2)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS surge_email_sent BOOLEAN DEFAULT FALSE`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS broadcast_id VARCHAR(100)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS cc VARCHAR(255)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS bcc VARCHAR(255)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS eta VARCHAR(100)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS etd VARCHAR(100)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS vessel_name VARCHAR(255)`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'pre-payment/credit'`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'approved'`
      ]);
    } catch (e) {
      console.log('Columns likely already exist or minor error:', e.message);
    }

    // Enable pg_trgm extension for fuzzy search in parallel
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
      await Promise.all([
        sql`CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (product_name gin_trgm_ops)`,
        sql`CREATE INDEX IF NOT EXISTS idx_products_partnum_trgm ON products USING GIN (part_number gin_trgm_ops)`
      ]);
      console.log('✅ pg_trgm extension and fuzzy search indexes ready');
    } catch (e) {
      console.log('pg_trgm setup note:', e.message);
    }

    console.log('✅ Database tables initialized successfully in', ((Date.now() - start) / 1000).toFixed(2), 'seconds');

    // Create default management account if it doesn't exist
    try {
      const existingMgmt = await sql`SELECT id FROM users WHERE username = 'admin_management'`;
      if (existingMgmt.length === 0) {
        const bcrypt = await import('bcryptjs');
        const salt = await bcrypt.default.genSalt(10);
        const hash = await bcrypt.default.hash('Management@123', salt);
        await sql`INSERT INTO users (username, password_hash, role) VALUES ('admin_management', ${hash}, 'management')`;
        console.log('✅ Default management account created');
      }
    } catch (e) {
      console.log('Note on management account:', e.message);
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}

export { sql };
