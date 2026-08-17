import cron from 'node-cron';
import { sql } from './db.js';

/**
 * Vortex Background Cron Jobs
 * 1. Automatically deletes inquiry records older than 1 week (7 days).
 * Runs every hour and also executes immediately upon server startup.
 */
export function initCronJobs() {
  console.log('⏳ Initializing Vortex Background Cron Jobs (Auto-delete inquiries older than 7 days)...');

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
}
