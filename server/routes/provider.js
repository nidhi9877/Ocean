import { Router } from 'express';
import { sql } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Register provider company details + products
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      address,
      city,
      country,
      description,
      products
    } = req.body;

    // Validate required fields
    if (!companyName || !contactPerson || !email || !phone || !address) {
      return res.status(400).json({ error: 'All company details are required' });
    }

    // Check if provider already exists for this user
    const existingProvider = await sql`
      SELECT id FROM providers WHERE user_id = ${req.user.id}
    `;
    if (existingProvider.length > 0) {
      return res.status(409).json({ error: 'Provider profile already exists for this user' });
    }

    // Insert provider
    const providerResult = await sql`
      INSERT INTO providers (user_id, company_name, contact_person, email, phone, address, city, country, description)
      VALUES (${req.user.id}, ${companyName}, ${contactPerson}, ${email}, ${phone}, ${address}, ${city || null}, ${country || null}, ${description || null})
      RETURNING id
    `;

    const providerId = providerResult[0].id;

    // Insert products if provided
    if (products && Array.isArray(products) && products.length > 0) {
      for (const product of products) {
        if (product.productName && product.category && product.price) {
          await sql`
            INSERT INTO products (provider_id, product_name, category, part_number, price, quantity, description)
            VALUES (${providerId}, ${product.productName}, ${product.category}, ${product.partNumber || null}, ${product.price}, ${product.quantity || 0}, ${product.description || null})
          `;
        }
      }
    }

    // Update user role to provider
    await sql`UPDATE users SET role = 'provider' WHERE id = ${req.user.id}`;

    res.status(201).json({
      message: 'Provider registration successful',
      providerId
    });
  } catch (error) {
    console.error('Provider registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk Insert Products for Provider
router.post('/bulk-products', authenticateToken, async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No valid products provided' });
    }

    // Get provider profile for this user
    const existingProvider = await sql`
      SELECT id FROM providers WHERE user_id = ${req.user.id}
    `;

    if (existingProvider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const providerId = existingProvider[0].id;

    let insertedCount = 0;
    for (const p of products) {
      if (p.productName && p.category && p.price) {
        await sql`
          INSERT INTO products (
            provider_id, product_name, category, brand, model_number, part_number, manufactured_at, location, price, quantity, description
          )
          VALUES (
            ${providerId}, 
            ${p.productName}, 
            ${p.category}, 
            ${p.brand || null}, 
            ${p.modelNumber || null}, 
            ${p.partNumber || null}, 
            ${p.manufacturedAt || null}, 
            ${p.location || null}, 
            ${p.price}, 
            ${p.quantity || 0}, 
            ${p.description || null}
          )
        `;
        insertedCount++;
      }
    }

    res.status(201).json({
      message: `Successfully added ${insertedCount} products.`,
      insertedCount
    });
  } catch (error) {
    console.error('Bulk insert error:', error);
    res.status(500).json({ error: 'Internal server error processing bulk insert' });
  }
});

// Get provider profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const providers = await sql`
      SELECT * FROM providers WHERE user_id = ${req.user.id}
    `;

    if (providers.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const provider = providers[0];

    // Get products for this provider
    const products = await sql`
      SELECT * FROM products WHERE provider_id = ${provider.id}
    `;

    res.json({ provider, products });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all products (for buyers)
router.get('/products', async (req, res) => {
  try {
    const products = await sql`
      SELECT p.*, pr.company_name, pr.contact_person, pr.email as provider_email
      FROM products p
      JOIN providers pr ON p.provider_id = pr.id
      ORDER BY p.created_at DESC
    `;

    res.json({ products });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get provider inquiries
router.get('/inquiries', authenticateToken, async (req, res) => {
  try {
    const existingProvider = await sql`
      SELECT id FROM providers WHERE user_id = ${req.user.id}
    `;

    if (existingProvider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const providerId = existingProvider[0].id;

    const inquiries = await sql`
      SELECT i.*, 
             p.product_name, p.part_number,
             b.ship_name, b.imo_number, b.ship_type, b.email as buyer_email, b.phone as buyer_phone,
             u.username as buyer_username
      FROM inquiries i
      LEFT JOIN products p ON i.product_id = p.id
      JOIN buyers b ON i.buyer_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE i.provider_id = ${providerId}
      ORDER BY i.created_at DESC
    `;

    res.json(inquiries);
  } catch (error) {
    console.error('Inquiries fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update inquiry status
router.put('/inquiries/:id/status', authenticateToken, async (req, res) => {
  try {
    const inquiryId = req.params.id;
    const { status } = req.body; // 'accepted' or 'rejected'
    
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const existingProvider = await sql`
      SELECT id FROM providers WHERE user_id = ${req.user.id}
    `;

    if (existingProvider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }
    const providerId = existingProvider[0].id;

    // Verify this inquiry belongs to this provider
    const inquiryQuery = await sql`
      SELECT id FROM inquiries WHERE id = ${inquiryId} AND provider_id = ${providerId}
    `;
    if (inquiryQuery.length === 0) {
      return res.status(403).json({ error: 'Not authorized for this inquiry' });
    }

    await sql`
      UPDATE inquiries 
      SET status = ${status}
      WHERE id = ${inquiryId}
    `;

    res.json({ message: `Inquiry marked as ${status}` });
  } catch (error) {
    console.error('Inquiry status update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
