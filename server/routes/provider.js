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
        const qty = Number(product.quantity) || 0;
        if (qty > 0) {
          await sql`
            INSERT INTO products (
              provider_id, product_name, category, brand, model_number, part_number, manufactured_at, location, price, quantity, description, additional_info
            )
            VALUES (
              ${providerId}, 
              ${product.productName || ''}, 
              ${product.category || ''}, 
              ${product.brand || null}, 
              ${product.modelNumber || null}, 
              ${product.partNumber || null}, 
              ${product.manufacturedAt || null}, 
              ${product.location || null}, 
              ${product.price || 0}, 
              ${qty}, 
              ${product.description || null},
              ${product.additionalInfo || null}
            )
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
    let skippedCount = 0;
    for (const p of products) {
      const qty = Number(p.quantity) || 0;
      if (qty > 0) {
        await sql`
          INSERT INTO products (
            provider_id, product_name, category, brand, model_number, part_number, manufactured_at, location, price, quantity, description, additional_info
          )
          VALUES (
            ${providerId}, 
            ${p.productName || ''}, 
            ${p.category || ''}, 
            ${p.brand || null}, 
            ${p.modelNumber || null}, 
            ${p.partNumber || null}, 
            ${p.manufacturedAt || null}, 
            ${p.location || null}, 
            ${p.price || 0}, 
            ${qty}, 
            ${p.description || null},
            ${p.additionalInfo || null}
          )
        `;
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    res.status(201).json({
      message: `Successfully added ${insertedCount} products.${skippedCount > 0 ? ` Skipped ${skippedCount} with zero/missing stock.` : ''}`,
      insertedCount,
      skippedCount
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

// Fuzzy search products (typo-tolerant, like Elasticsearch)
router.get('/products/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({ products: [], suggestions: [] });
    }

    const searchTerm = q.trim().toLowerCase();
    const similarityThreshold = 0.15; // Lower = more lenient fuzzy matching

    // Set the similarity threshold for this session
    await sql`SELECT set_limit(${similarityThreshold})`;

    // Fuzzy search using pg_trgm similarity across multiple fields
    // Results are ranked by the best similarity score across all searched fields
    const products = await sql`
      SELECT p.*, pr.company_name, pr.contact_person, pr.email as provider_email,
             GREATEST(
               COALESCE(similarity(LOWER(p.product_name), ${searchTerm}), 0),
               COALESCE(similarity(LOWER(COALESCE(p.part_number, '')), ${searchTerm}), 0),
               COALESCE(similarity(LOWER(COALESCE(p.brand, '')), ${searchTerm}), 0),
               COALESCE(similarity(LOWER(COALESCE(p.category, '')), ${searchTerm}), 0)
             ) AS relevance_score
      FROM products p
      JOIN providers pr ON p.provider_id = pr.id
      WHERE 
        LOWER(p.product_name) % ${searchTerm}
        OR LOWER(COALESCE(p.part_number, '')) % ${searchTerm}
        OR LOWER(COALESCE(p.brand, '')) % ${searchTerm}
        OR LOWER(COALESCE(p.category, '')) % ${searchTerm}
        OR LOWER(p.product_name) ILIKE ${'%' + searchTerm + '%'}
        OR LOWER(COALESCE(p.part_number, '')) ILIKE ${'%' + searchTerm + '%'}
      ORDER BY relevance_score DESC, p.product_name ASC
      LIMIT 100
    `;

    // Build unique autocomplete suggestions from matched product names
    const suggestionSet = new Set();
    for (const p of products) {
      if (suggestionSet.size >= 8) break;
      suggestionSet.add(p.product_name);
    }
    const suggestions = [...suggestionSet];

    // Determine "did you mean" — find the best matching product name if input is fuzzy
    let didYouMean = null;
    if (products.length > 0) {
      const topProduct = products[0];
      const topName = topProduct.product_name.toLowerCase();
      // Only show "did you mean" if the search term is clearly different from the match
      if (!topName.includes(searchTerm) && !searchTerm.includes(topName) && topProduct.relevance_score < 0.8) {
        didYouMean = topProduct.product_name;
      }
    }

    res.json({ products, suggestions, didYouMean });
  } catch (error) {
    console.error('Fuzzy search error:', error);
    res.status(500).json({ error: 'Internal server error during search' });
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

// Update a single product
router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      product_name, category, brand, model_number,
      part_number, manufactured_at, location, price,
      quantity, description, additional_info
    } = req.body;

    // Get provider for this user
    const existingProvider = await sql`
      SELECT id FROM providers WHERE user_id = ${req.user.id}
    `;
    if (existingProvider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }
    const providerId = existingProvider[0].id;

    // Verify product belongs to this provider
    const productQuery = await sql`
      SELECT id FROM products WHERE id = ${productId} AND provider_id = ${providerId}
    `;
    if (productQuery.length === 0) {
      return res.status(403).json({ error: 'Not authorized to edit this product' });
    }

    await sql`
      UPDATE products SET
        product_name = ${product_name},
        category = ${category},
        brand = ${brand || null},
        model_number = ${model_number || null},
        part_number = ${part_number || null},
        manufactured_at = ${manufactured_at || null},
        location = ${location || null},
        price = ${price},
        quantity = ${quantity || 0},
        description = ${description || null},
        additional_info = ${additional_info || null}
      WHERE id = ${productId}
    `;

    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a single product
router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.id;
    // Get provider for this user
    const existingProvider = await sql`SELECT id FROM providers WHERE user_id = ${req.user.id}`;
    if (existingProvider.length === 0) return res.status(404).json({ error: 'Provider profile not found' });
    const providerId = existingProvider[0].id;

    // Verify product belongs to this provider
    const productQuery = await sql`SELECT id FROM products WHERE id = ${productId} AND provider_id = ${providerId}`;
    if (productQuery.length === 0) return res.status(403).json({ error: 'Not authorized to delete this product' });

    await sql`DELETE FROM products WHERE id = ${productId}`;
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Product delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete bulk products
router.post('/products/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No product IDs provided' });

    const existingProvider = await sql`SELECT id FROM providers WHERE user_id = ${req.user.id}`;
    if (existingProvider.length === 0) return res.status(404).json({ error: 'Provider profile not found' });
    const providerId = existingProvider[0].id;

    await sql`DELETE FROM products WHERE id = ANY(${ids}) AND provider_id = ${providerId}`;
    res.json({ message: 'Products deleted successfully' });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete all products
router.delete('/products', authenticateToken, async (req, res) => {
  try {
    const existingProvider = await sql`SELECT id FROM providers WHERE user_id = ${req.user.id}`;
    if (existingProvider.length === 0) return res.status(404).json({ error: 'Provider profile not found' });
    const providerId = existingProvider[0].id;

    await sql`DELETE FROM products WHERE provider_id = ${providerId}`;
    res.json({ message: 'All products deleted successfully' });
  } catch (error) {
    console.error('Delete all error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
