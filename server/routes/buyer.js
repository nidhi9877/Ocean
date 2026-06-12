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
    const { selections, destination_location, delivery_requirements, cc, bcc } = req.body;
    // selections is an array of objects { provider_id, product_id }
    
    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'No products selected for inquiry' });
    }

    if (!destination_location) {
      return res.status(400).json({ error: 'Destination location is required' });
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

    for (const sel of selections) {
      // Insert inquiry into DB
      await sql`
        INSERT INTO inquiries (buyer_id, provider_id, product_id, destination_location, target_price, broadcast_id, cc, bcc)
        VALUES (${buyer_id}, ${sel.provider_id}, ${sel.product_id}, ${destination_location}, NULL, ${broadcast_id}, ${cc || null}, ${bcc || null})
      `;
    }

    res.status(201).json({ 
      message: 'Inquiries registered successfully.'
    });
  } catch (error) {
    console.error('Error posting inquiry:', error);
    res.status(500).json({ error: 'Internal server error while registering inquiry' });
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
