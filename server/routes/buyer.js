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

    const eta = delivery_requirements?.eta || req.body.eta;
    const etd = delivery_requirements?.etd || req.body.etd || null;
    const vesselName = delivery_requirements?.vessel_name || req.body.vessel_name || req.body.vesselName;

    if (!destination_location || !destination_location.trim()) {
      return res.status(400).json({ error: 'Destination location is required.' });
    }

    if (!eta || !eta.toString().trim()) {
      return res.status(400).json({ error: 'ETA is compulsory for sending an inquiry.' });
    }

    if (!vesselName || !vesselName.toString().trim()) {
      return res.status(400).json({ error: 'Vessel Name is compulsory for sending an inquiry.' });
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
        INSERT INTO inquiries (buyer_id, provider_id, product_id, destination_location, eta, etd, vessel_name, target_price, broadcast_id, cc, bcc)
        VALUES (${buyer_id}, ${sel.provider_id}, ${sel.product_id}, ${destination_location.trim()}, ${eta.toString().trim()}, ${etd ? etd.toString().trim() : null}, ${vesselName.toString().trim()}, NULL, ${broadcast_id}, ${cc || null}, ${bcc || null})
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

// ─── POST /searches — Log buyer searched products ─────────────────────────────
router.post('/searches', authenticateToken, async (req, res) => {
  try {
    const { product_ids, search_query } = req.body;
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'No product IDs provided.' });
    }

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can log search history.' });
    }
    const buyer_id = buyerProfile[0].id;

    // Limit batch size to top 20 results to avoid massive bulk writes
    const safeProductIds = product_ids.slice(0, 20);

    for (const pid of safeProductIds) {
      await sql`
        INSERT INTO buyer_searches (buyer_id, product_id, search_query, created_at)
        VALUES (${buyer_id}, ${pid}, ${search_query || null}, NOW())
        ON CONFLICT (buyer_id, product_id)
        DO UPDATE SET created_at = NOW(), search_query = EXCLUDED.search_query
      `;
    }

    res.json({ message: 'Search activity logged.' });
  } catch (error) {
    console.error('Error logging search activity:', error);
    res.status(500).json({ error: 'Failed to log search activity.' });
  }
});

// ─── GET /inquiries — Get recent buyer inquiries & searches (within 1 week limit) ───
router.get('/inquiries', authenticateToken, async (req, res) => {
  try {
    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can view inquiries.' });
    }
    const buyer_id = buyerProfile[0].id;

    // Automatically purge records older than 1 week (7 days)
    await sql`DELETE FROM inquiries WHERE created_at < NOW() - INTERVAL '7 days'`;
    await sql`DELETE FROM buyer_searches WHERE created_at < NOW() - INTERVAL '7 days'`;

    // 1. Fetch Sent Inquiries
    const inquiries = await sql`
      SELECT 
        i.id,
        'inquiry' as item_type,
        'sent' as category,
        i.product_id,
        i.destination_location,
        i.vessel_name,
        i.eta,
        i.etd,
        i.cc,
        i.bcc,
        i.created_at,
        p.product_name,
        p.part_number,
        p.brand,
        p.model_number,
        p.location as product_location,
        p.price as product_price,
        pr.id as provider_id,
        pr.company_name,
        pr.email as provider_email
      FROM inquiries i
      LEFT JOIN products p ON i.product_id = p.id
      JOIN providers pr ON i.provider_id = pr.id
      WHERE i.buyer_id = ${buyer_id}
        AND i.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY i.created_at DESC
    `;

    // 2. Fetch Searched Products (excluding ones that already have an inquiry)
    const searchedProducts = await sql`
      SELECT 
        s.id,
        'search' as item_type,
        'searched' as category,
        s.product_id,
        NULL as destination_location,
        NULL as vessel_name,
        NULL as eta,
        NULL as etd,
        NULL as cc,
        NULL as bcc,
        s.created_at,
        p.product_name,
        p.part_number,
        p.brand,
        p.model_number,
        p.location as product_location,
        p.price as product_price,
        pr.id as provider_id,
        pr.company_name,
        pr.email as provider_email
      FROM buyer_searches s
      JOIN products p ON s.product_id = p.id
      JOIN providers pr ON p.provider_id = pr.id
      WHERE s.buyer_id = ${buyer_id}
        AND s.created_at >= NOW() - INTERVAL '7 days'
        AND s.product_id NOT IN (
          SELECT product_id FROM inquiries WHERE buyer_id = ${buyer_id} AND product_id IS NOT NULL
        )
      ORDER BY s.created_at DESC
    `;

    // Combine and sort by created_at DESC
    const combined = [...inquiries, ...searchedProducts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json(combined);
  } catch (error) {
    console.error('Inquiries/Recents fetch error:', error);
    res.status(500).json({ error: 'Internal server error while fetching recents.' });
  }
});

export default router;
