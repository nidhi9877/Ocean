import { Router } from 'express';
import crypto from 'crypto';
import { sql } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendInquiryEmail, sendProviderNotification } from '../utils/email.js';

const router = Router();

// ─── POST /inquiries — Send inquiry + professional email to vendor ───────────
// Accepts an array of product selections, inserts inquiry records into the DB,
// and fires off a Resend-powered HTML email to each vendor with full product
// details. Sets Reply-To to the buyer's email so vendors can reply directly.
router.post('/inquiries', authenticateToken, async (req, res) => {
  try {
    const { selections, destination_location, target_price, delivery_requirements } = req.body;
    // selections is an array of objects { provider_id, product_id }
    
    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'No products selected for inquiry' });
    }

    if (!destination_location) {
      return res.status(400).json({ error: 'Destination location is required' });
    }

    if (!target_price) {
      return res.status(400).json({ error: 'Target Price is required' });
    }

    // Get the buyer profile
    const buyerProfile = await sql`
      SELECT b.id, b.email as buyer_email, u.username as buyer_name
      FROM buyers b
      JOIN users u ON b.user_id = u.id
      WHERE b.user_id = ${req.user.id}
    `;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can send inquiries.' });
    }

    const buyer_id = buyerProfile[0].id;
    const buyerEmail = buyerProfile[0].buyer_email;
    const buyerName = buyerProfile[0].buyer_name;

    // Generate a single broadcast ID for this batch of inquiries
    const broadcast_id = crypto.randomUUID();

    let sentCount = 0;
    let failedCount = 0;

    for (const sel of selections) {
      // Insert inquiry into DB
      const insertResult = await sql`
        INSERT INTO inquiries (buyer_id, provider_id, product_id, destination_location, target_price, broadcast_id)
        VALUES (${buyer_id}, ${sel.provider_id}, ${sel.product_id}, ${destination_location}, ${target_price}, ${broadcast_id})
        RETURNING id
      `;

      const inquiryId = insertResult[0].id;

      // Fetch vendor + product details for the email
      const providerData = await sql`
        SELECT company_name, email, contact_person FROM providers WHERE id = ${sel.provider_id}
      `;
      const productData = await sql`
        SELECT product_name, brand, part_number, price FROM products WHERE id = ${sel.product_id}
      `;

      if (providerData.length > 0 && productData.length > 0) {
        try {
          await sendInquiryEmail({
            vendorName: providerData[0].company_name,
            vendorEmail: providerData[0].email,
            buyerName,
            buyerEmail,
            productName: productData[0].product_name,
            brand: productData[0].brand,
            partNumber: productData[0].part_number,
            targetPrice: target_price, // Override with buyer's aggressive target price
            deliveryPort: destination_location,
            deliveryRequirements: delivery_requirements,
            inquiryId,
          });
          sentCount++;
        } catch (emailErr) {
          console.error(`Failed to send email for inquiry ${inquiryId}:`, emailErr.message);
          failedCount++;
        }
      }
    }

    res.status(201).json({ 
      message: `Inquiries sent successfully. ${sentCount} email(s) delivered.${failedCount > 0 ? ` ${failedCount} failed.` : ''}`,
      sentCount,
      failedCount,
    });
  } catch (error) {
    console.error('Error posting inquiry:', error);
    res.status(500).json({ error: 'Internal server error while sending inquiry' });
  }
});

// ─── GET /inquiries — Get all buyer inquiries ────────────────────────────────
router.get('/inquiries', authenticateToken, async (req, res) => {
  try {
    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can view inquiries.' });
    }
    const buyer_id = buyerProfile[0].id;

    const inquiries = await sql`
      SELECT i.*, 
             p.product_name, p.part_number,
             pr.company_name, pr.email as provider_email, pr.phone as provider_phone
      FROM inquiries i
      LEFT JOIN products p ON i.product_id = p.id
      JOIN providers pr ON i.provider_id = pr.id
      WHERE i.buyer_id = ${buyer_id}
      ORDER BY i.created_at DESC
    `;

    res.json(inquiries);
  } catch (error) {
    console.error('Inquiries fetch error:', error);
    res.status(500).json({ error: 'Internal server error while fetching inquiries.' });
  }
});

export default router;
