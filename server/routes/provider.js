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

export default router;
