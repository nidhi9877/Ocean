import cron from 'node-cron';
import { sql } from './db.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const SYSTEM_FROM = process.env.SYSTEM_EMAIL_FROM || 'Vortex Marketplace <onboarding@resend.dev>';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * The Surge Pricing Engine
 * Runs every 30 minutes.
 * Scans for pending inquiries older than 1 hour where the buyer hasn't been emailed yet.
 * Sends a FOMO/Surge email to the buyer urging them to increase the Target Price.
 */
export function initCronJobs() {
  console.log('⏳ Initializing Vortex Surge Pricing Engine (Cron Jobs)...');

  cron.schedule('*/30 * * * *', async () => {
    console.log('⚙️ [Cron] Running Surge Pricing Check...');

    try {
      // Find pending inquiries older than 1 hour where surge email hasn't been sent
      // Join with buyers, users, and products to get email details
      const pendingInquiries = await sql`
        SELECT 
          i.id as inquiry_id, 
          i.target_price,
          i.destination_location,
          b.email as buyer_email,
          u.username as buyer_name,
          p.product_name
        FROM inquiries i
        JOIN buyers b ON i.buyer_id = b.id
        JOIN users u ON b.user_id = u.id
        JOIN products p ON i.product_id = p.id
        WHERE i.status = 'pending' 
          AND i.created_at < NOW() - INTERVAL '1 hour'
          AND i.surge_email_sent = FALSE
      `;

      if (pendingInquiries.length === 0) {
        console.log('⚙️ [Cron] No stagnant inquiries found. Market is clearing efficiently.');
        return;
      }

      console.log(`⚙️ [Cron] Found ${pendingInquiries.length} stagnant inquiries. Sending Surge Alerts...`);

      for (const inquiry of pendingInquiries) {
        const recommendedPrice = Number(inquiry.target_price) * 1.15; // 15% increase

        const html = `
          <div style="font-family:Arial,sans-serif;padding:20px;color:#e2e8f0;background:#0f172a;border-radius:12px;border:1px solid rgba(239,68,68,0.2);">
            <h2 style="color:#ef4444;text-transform:uppercase;">⚠️ Urgent: High Market Demand</h2>
            <p>Captain <strong>${inquiry.buyer_name}</strong>,</p>
            <p>No vendor has accepted your target price of <strong>₹${Number(inquiry.target_price).toLocaleString('en-IN')}</strong> for <strong>${inquiry.product_name}</strong> (Destination: ${inquiry.destination_location}).</p>
            
            <div style="background:#1e293b;padding:15px;border-left:4px solid #ef4444;margin:15px 0;border-radius:6px;">
              <p style="margin:0;color:#fca5a5;">To avoid port delays and secure this critical spare part, our algorithms recommend increasing your budget by 15%.</p>
              <h3 style="color:#22c55e;margin:10px 0 0 0;">Recommended Price: ₹${recommendedPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            </div>

            <p>Vendors on Vortex operate on a First-to-Accept model. A higher Target Price will instantly clear the market.</p>
            
            <div style="text-align:center;margin-top:25px;">
              <a href="${BASE_URL}/buyer/inquiries" style="display:inline-block;padding:14px 30px;background:#ef4444;color:#fff;text-decoration:none;font-weight:bold;border-radius:8px;letter-spacing:0.5px;">
                INCREASE TARGET PRICE & RE-BROADCAST
              </a>
            </div>
            <br/>
            <p style="font-size:12px;color:#64748b;">Vortex Automated Execution Engine</p>
          </div>
        `;

        try {
          await resend.emails.send({
            from: SYSTEM_FROM,
            to: inquiry.buyer_email,
            subject: `Action Required: No responses for ${inquiry.product_name}`,
            html,
          });

          // Mark as sent so we don't spam the buyer
          await sql`
            UPDATE inquiries 
            SET surge_email_sent = TRUE 
            WHERE id = ${inquiry.inquiry_id}
          `;
          
          console.log(`✅ [Cron] Surge Alert sent to ${inquiry.buyer_email} for inquiry ${inquiry.inquiry_id}`);
        } catch (emailErr) {
          console.error(`❌ [Cron] Failed to send Surge Alert for inquiry ${inquiry.inquiry_id}:`, emailErr.message);
        }
      }

    } catch (err) {
      console.error('❌ [Cron] Error running Surge Pricing Check:', err);
    }
  });
}
