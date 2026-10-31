import cron from 'node-cron';
import { sql } from './db.js';
import { sendLowStockEmail } from './utils/email.js';

// Must match LOW_STOCK_THRESHOLD in client/src/pages/ProviderDashboard.jsx (the red pop-up)
export const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_EMAIL_TZ = process.env.LOW_STOCK_EMAIL_TZ || 'Asia/Kolkata';

/**
 * MarineStockHub Background Cron Jobs
 * 1. Automatically deletes inquiry records older than 1 week (7 days).
 * Runs every hour and also executes immediately upon server startup.
 */
export function initCronJobs() {
  console.log('⏳ Initializing MarineStockHub Background Cron Jobs (Auto-delete inquiries older than 7 days)...');

  // Helper function to clean up expired inquiries and searches
  const cleanupExpiredRecords = async (source = 'Scheduled') => {
    try {
      const deletedInquiries = await sql`
        DELETE FROM inquiries 
        WHERE created_at < NOW() - INTERVAL '7 days'
        RETURNING id
      `;
      const deletedSearches = await sql`
        DELETE FROM buyer_searches
        WHERE created_at < NOW() - INTERVAL '7 days'
        RETURNING id
      `;
      const deletedSessions = await sql`
        DELETE FROM user_sessions
        WHERE last_active < NOW() - INTERVAL '10 minutes' OR created_at < NOW() - INTERVAL '24 hours'
        RETURNING id
      `;
      if (deletedInquiries.length > 0 || deletedSearches.length > 0) {
        console.log(`🧹 [${source} Cleanup] Deleted ${deletedInquiries.length} inquiry and ${deletedSearches.length} search record(s) older than 1 week (7 days).`);
      }
    } catch (err) {
      console.error(`❌ [${source} Cleanup] Error cleaning up expired records:`, err.message);
    }
  };

  // Run on startup
  cleanupExpiredRecords('Startup');

  // Schedule to run every hour at minute 0
  cron.schedule('0 * * * *', () => {
    cleanupExpiredRecords('Hourly Cron');
  });

  // Every evening at 5 PM: email each approved seller the same low-stock warning the dashboard pops up
  cron.schedule('0 17 * * *', () => {
    sendDailyLowStockEmails();
  }, { timezone: LOW_STOCK_EMAIL_TZ });
  console.log(`📧 Daily low-stock emails scheduled for 5:00 PM (${LOW_STOCK_EMAIL_TZ})`);
}

export async function sendDailyLowStockEmails() {
  try {
    const rows = await sql`
      SELECT pr.id AS provider_id, pr.email, pr.company_name, u.username,
             p.product_name, p.part_number, p.category, p.brand, p.model_number, p.quantity
      FROM products p
      JOIN providers pr ON pr.id = p.provider_id
      JOIN users u ON u.id = pr.user_id
      WHERE COALESCE(p.quantity, 0) < ${LOW_STOCK_THRESHOLD}
        AND COALESCE(pr.status, 'approved') = 'approved'
      ORDER BY pr.id, p.quantity ASC, p.product_name
    `;

    const bySeller = new Map();
    for (const r of rows) {
      if (!bySeller.has(r.provider_id)) {
        bySeller.set(r.provider_id, { to: r.email, username: r.username, companyName: r.company_name, products: [] });
      }
      bySeller.get(r.provider_id).products.push({
        ...r,
        name: (r.product_name || '').trim() || (r.part_number ? `Part No. ${r.part_number}` : r.category || 'Unnamed product'),
      });
    }

    let sent = 0;
    for (const seller of bySeller.values()) {
      try {
        await sendLowStockEmail({ ...seller, threshold: LOW_STOCK_THRESHOLD });
        sent++;
      } catch (err) {
        console.error(`❌ [Low Stock Email] Failed for ${seller.to}:`, err.message);
      }
    }
    console.log(`📧 [Low Stock Email] Sent ${sent}/${bySeller.size} seller email(s).`);
  } catch (err) {
    console.error('❌ [Low Stock Email] Job failed:', err.message);
  }
}
