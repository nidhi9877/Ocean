import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load server/.env regardless of the directory node was started from (e.g. `npm start` at repo root).
dotenv.config({ path: new URL('./.env', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

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
        payment_mode VARCHAR(50) DEFAULT 'pre-payment',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS buyers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        country VARCHAR(100),
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
        serial_number VARCHAR(100),
        manufactured_at VARCHAR(255),
        location VARCHAR(255),
        price DECIMAL(10,2) NOT NULL,
        quantity INTEGER DEFAULT 0,
        description TEXT,
        additional_info TEXT,
        media_link TEXT,
        equipment_condition VARCHAR(50) DEFAULT 'New',
        service_type VARCHAR(50) DEFAULT 'Supply',
        payment_mode VARCHAR(50) DEFAULT 'pre-payment',
        department VARCHAR(255),
        warranty VARCHAR(100),
        part_category VARCHAR(50) DEFAULT 'Spare Part',
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
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_active TIMESTAMPTZ DEFAULT NOW()
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

    await sql`
      CREATE TABLE IF NOT EXISTS buyer_ships (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE,
        ship_name VARCHAR(255) NOT NULL,
        imo_number VARCHAR(100),
        ship_type VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS buyer_specifications (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE,
        ship_id INTEGER REFERENCES buyer_ships(id) ON DELETE CASCADE,
        equipment VARCHAR(255) NOT NULL,
        manufacturer VARCHAR(255),
        model VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Password reset tokens — only the SHA-256 hash of the token is stored
    await sql`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // One-time email verification codes for registration — only the SHA-256 hash is stored
    await sql`
      CREATE TABLE IF NOT EXISTS email_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(64) NOT NULL,
        attempts INTEGER DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Evidence of Terms & Conditions acceptance — one row per acceptance, never updated
    await sql`
      CREATE TABLE IF NOT EXISTS terms_acceptances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        terms_version VARCHAR(64) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address VARCHAR(100),
        user_agent TEXT
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user ON terms_acceptances (user_id, accepted_at DESC)`;

    // ── Reseller wallet (prepaid credit, charged per enquiry) ──
    // activated_at is set once the balance first reaches the minimum initial recharge;
    // until then the reseller cannot send enquiries.
    await sql`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
        activated_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    // Ledger — one row per credit / debit. reference is unique so a payment can never be credited twice.
    await sql`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        balance_after NUMERIC(12,2) NOT NULL,
        source VARCHAR(20) NOT NULL,
        reference VARCHAR(120) UNIQUE,
        note TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions (user_id, created_at DESC)`;
    // Admin-editable platform settings (key/value)
    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
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
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS equipment_condition VARCHAR(50) DEFAULT 'New'`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'Supply'`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'pre-payment'`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS department VARCHAR(255)`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty VARCHAR(100)`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS part_category VARCHAR(50) DEFAULT 'Spare Part'`,
        sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS target_price DECIMAL(10,2)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS surge_email_sent BOOLEAN DEFAULT FALSE`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS broadcast_id VARCHAR(100)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS cc VARCHAR(255)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS bcc VARCHAR(255)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS eta VARCHAR(100)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS etd VARCHAR(100)`,
        sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS vessel_name VARCHAR(255)`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'pre-payment'`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS country VARCHAR(100)`,
        sql`ALTER TABLE buyers ADD COLUMN IF NOT EXISTS country VARCHAR(100)`,
        // Existing buyers are grandfathered as approved; new registrations insert 'pending' explicitly
        sql`ALTER TABLE buyers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'approved'`,
        sql`ALTER TABLE buyers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
        sql`ALTER TABLE buyers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
        sql`ALTER TABLE buyer_specifications ADD COLUMN IF NOT EXISTS ship_id INTEGER REFERENCES buyer_ships(id) ON DELETE CASCADE`,
        sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW()`,
        // Seller inactivity discipline (warn after 7 days without login, freeze 2 days later)
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS inactivity_warned_at TIMESTAMPTZ`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS unfreeze_requested_at TIMESTAMPTZ`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS unfreeze_note TEXT`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS activity_reset_at TIMESTAMPTZ`,
        sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS inventory_verified_at TIMESTAMPTZ`
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
