import { Router } from 'express';
import { sql } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Post an inquiry for a product
router.post('/inquiries', authenticateToken, async (req, res) => {
  try {
    const { selections, destination_location, messageType } = req.body;
    // selections is an array of objects { provider_id, product_id }
    
    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'No products selected for inquiry' });
    }

    if (!destination_location) {
      return res.status(400).json({ error: 'Destination location is required' });
    }

    // Get the buyer details to optionally link to exact buyer profile
    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can send inquiries.' });
    }
    const buyer_id = buyerProfile[0].id;

    for (const sel of selections) {
      await sql`
        INSERT INTO inquiries (buyer_id, provider_id, product_id, destination_location)
        VALUES (${buyer_id}, ${sel.provider_id}, ${sel.product_id}, ${destination_location})
      `;
    }

    res.status(201).json({ message: 'Inquiries sent successfully' });
  } catch (error) {
    console.error('Error posting inquiry:', error);
    res.status(500).json({ error: 'Internal server error while sending inquiry' });
  }
});

// Get buyer inquiries
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
