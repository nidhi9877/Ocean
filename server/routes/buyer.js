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
    const vesselName = (delivery_requirements?.vessel_name || req.body.vessel_name || req.body.vesselName || '').toString().trim() || null;

    if (!destination_location || !destination_location.trim()) {
      return res.status(400).json({ error: 'Destination location is required.' });
    }

    if (!eta || !eta.toString().trim()) {
      return res.status(400).json({ error: 'ETA is compulsory for sending an inquiry.' });
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
        VALUES (${buyer_id}, ${sel.provider_id}, ${sel.product_id}, ${destination_location.trim()}, ${eta.toString().trim()}, ${etd ? etd.toString().trim() : null}, ${vesselName}, NULL, ${broadcast_id}, ${cc || null}, ${bcc || null})
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

// ═══════════════════════════════════════════════════════════════════════════════
// SHIP MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /ships — Create a new ship ──────────────────────────────────────────
router.post('/ships', authenticateToken, async (req, res) => {
  try {
    const { ship_name, imo_number, ship_type } = req.body;
    if (!ship_name || !ship_name.trim()) {
      return res.status(400).json({ error: 'Ship name is required.' });
    }

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can create ships.' });
    }
    const buyer_id = buyerProfile[0].id;

    const result = await sql`
      INSERT INTO buyer_ships (buyer_id, ship_name, imo_number, ship_type)
      VALUES (${buyer_id}, ${ship_name.trim()}, ${imo_number ? imo_number.trim() : null}, ${ship_type ? ship_type.trim() : null})
      RETURNING id, ship_name, imo_number, ship_type, created_at
    `;

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating ship:', error);
    res.status(500).json({ error: 'Internal server error while creating ship.' });
  }
});

// ─── GET /ships — List all buyer's ships (with spec count) ────────────────────
router.get('/ships', authenticateToken, async (req, res) => {
  try {
    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can view ships.' });
    }
    const buyer_id = buyerProfile[0].id;

    const ships = await sql`
      SELECT s.id, s.ship_name, s.imo_number, s.ship_type, s.created_at,
        (SELECT COUNT(*) FROM buyer_specifications bs WHERE bs.ship_id = s.id)::int AS spec_count
      FROM buyer_ships s
      WHERE s.buyer_id = ${buyer_id}
      ORDER BY s.created_at DESC
    `;

    res.json(ships);
  } catch (error) {
    console.error('Error fetching ships:', error);
    res.status(500).json({ error: 'Internal server error while fetching ships.' });
  }
});

// ─── PUT /ships/:shipId — Update ship details ──────────────────────────────────
router.put('/ships/:shipId', authenticateToken, async (req, res) => {
  try {
    const { shipId } = req.params;
    const { ship_name, imo_number, ship_type } = req.body;

    if (!ship_name || !ship_name.trim()) {
      return res.status(400).json({ error: 'Ship name is required.' });
    }

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can update ships.' });
    }
    const buyer_id = buyerProfile[0].id;

    const ship = await sql`SELECT id FROM buyer_ships WHERE id = ${shipId} AND buyer_id = ${buyer_id}`;
    if (ship.length === 0) {
      return res.status(404).json({ error: 'Ship not found.' });
    }

    const updated = await sql`
      UPDATE buyer_ships
      SET ship_name = ${ship_name.trim()},
          imo_number = ${imo_number ? imo_number.trim() : null},
          ship_type = ${ship_type ? ship_type.trim() : null}
      WHERE id = ${shipId} AND buyer_id = ${buyer_id}
      RETURNING id, ship_name, imo_number, ship_type, created_at
    `;

    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating ship:', error);
    res.status(500).json({ error: 'Internal server error while updating ship.' });
  }
});

// ─── DELETE /ships/:shipId — Delete a ship and its specifications ─────────────
router.delete('/ships/:shipId', authenticateToken, async (req, res) => {
  try {
    const { shipId } = req.params;

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can delete ships.' });
    }
    const buyer_id = buyerProfile[0].id;

    // Verify ship belongs to this buyer
    const ship = await sql`SELECT id FROM buyer_ships WHERE id = ${shipId} AND buyer_id = ${buyer_id}`;
    if (ship.length === 0) {
      return res.status(404).json({ error: 'Ship not found.' });
    }

    // Cascade delete removes specs too
    await sql`DELETE FROM buyer_ships WHERE id = ${shipId} AND buyer_id = ${buyer_id}`;

    res.json({ message: 'Ship and its specifications deleted.' });
  } catch (error) {
    console.error('Error deleting ship:', error);
    res.status(500).json({ error: 'Internal server error while deleting ship.' });
  }
});

// ─── POST /ships/:shipId/specifications — Save specs for a specific ship (bulk)
router.post('/ships/:shipId/specifications', authenticateToken, async (req, res) => {
  try {
    const { shipId } = req.params;
    const { specifications, mode } = req.body;

    if (!specifications || !Array.isArray(specifications) || specifications.length === 0) {
      return res.status(400).json({ error: 'No specifications provided.' });
    }

    for (const spec of specifications) {
      if (!spec.equipment || !spec.equipment.trim()) {
        return res.status(400).json({ error: 'Each specification must have an Equipment field.' });
      }
    }

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can save specifications.' });
    }
    const buyer_id = buyerProfile[0].id;

    // Verify ship belongs to this buyer
    const ship = await sql`SELECT id FROM buyer_ships WHERE id = ${shipId} AND buyer_id = ${buyer_id}`;
    if (ship.length === 0) {
      return res.status(404).json({ error: 'Ship not found.' });
    }

    // If mode is not 'append', delete existing specs (replace mode by default)
    if (mode !== 'append') {
      await sql`DELETE FROM buyer_specifications WHERE ship_id = ${shipId}`;
    }

    // Insert new specifications
    for (const spec of specifications) {
      await sql`
        INSERT INTO buyer_specifications (buyer_id, ship_id, equipment, manufacturer, model)
        VALUES (${buyer_id}, ${shipId}, ${spec.equipment.trim()}, ${spec.manufacturer ? spec.manufacturer.trim() : null}, ${spec.model ? spec.model.trim() : null})
      `;
    }

    res.status(201).json({ message: `${specifications.length} specification(s) saved for ship.` });
  } catch (error) {
    console.error('Error saving ship specifications:', error);
    res.status(500).json({ error: 'Internal server error while saving specifications.' });
  }
});

// ─── POST /ships/:shipId/specifications/item — Add a single specification manually
router.post('/ships/:shipId/specifications/item', authenticateToken, async (req, res) => {
  try {
    const { shipId } = req.params;
    const { equipment, manufacturer, model } = req.body;

    if (!equipment || !equipment.trim()) {
      return res.status(400).json({ error: 'Equipment name is required.' });
    }

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can add specifications.' });
    }
    const buyer_id = buyerProfile[0].id;

    const ship = await sql`SELECT id FROM buyer_ships WHERE id = ${shipId} AND buyer_id = ${buyer_id}`;
    if (ship.length === 0) {
      return res.status(404).json({ error: 'Ship not found.' });
    }

    const result = await sql`
      INSERT INTO buyer_specifications (buyer_id, ship_id, equipment, manufacturer, model)
      VALUES (${buyer_id}, ${shipId}, ${equipment.trim()}, ${manufacturer ? manufacturer.trim() : null}, ${model ? model.trim() : null})
      RETURNING id, equipment, manufacturer, model, created_at
    `;

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error adding specification item:', error);
    res.status(500).json({ error: 'Internal server error while adding specification.' });
  }
});

// ─── PUT /ships/:shipId/specifications/:specId — Update single specification manually
router.put('/ships/:shipId/specifications/:specId', authenticateToken, async (req, res) => {
  try {
    const { shipId, specId } = req.params;
    const { equipment, manufacturer, model } = req.body;

    if (!equipment || !equipment.trim()) {
      return res.status(400).json({ error: 'Equipment name is required.' });
    }

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can update specifications.' });
    }
    const buyer_id = buyerProfile[0].id;

    const spec = await sql`
      SELECT id FROM buyer_specifications
      WHERE id = ${specId} AND ship_id = ${shipId} AND buyer_id = ${buyer_id}
    `;
    if (spec.length === 0) {
      return res.status(404).json({ error: 'Specification not found.' });
    }

    const updated = await sql`
      UPDATE buyer_specifications
      SET equipment = ${equipment.trim()},
          manufacturer = ${manufacturer ? manufacturer.trim() : null},
          model = ${model ? model.trim() : null}
      WHERE id = ${specId} AND ship_id = ${shipId} AND buyer_id = ${buyer_id}
      RETURNING id, equipment, manufacturer, model, created_at
    `;

    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating specification item:', error);
    res.status(500).json({ error: 'Internal server error while updating specification.' });
  }
});

// ─── DELETE /ships/:shipId/specifications/:specId — Delete single specification
router.delete('/ships/:shipId/specifications/:specId', authenticateToken, async (req, res) => {
  try {
    const { shipId, specId } = req.params;

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can delete specifications.' });
    }
    const buyer_id = buyerProfile[0].id;

    const spec = await sql`
      SELECT id FROM buyer_specifications
      WHERE id = ${specId} AND ship_id = ${shipId} AND buyer_id = ${buyer_id}
    `;
    if (spec.length === 0) {
      return res.status(404).json({ error: 'Specification not found.' });
    }

    await sql`
      DELETE FROM buyer_specifications
      WHERE id = ${specId} AND ship_id = ${shipId} AND buyer_id = ${buyer_id}
    `;

    res.json({ message: 'Specification deleted successfully.' });
  } catch (error) {
    console.error('Error deleting specification item:', error);
    res.status(500).json({ error: 'Internal server error while deleting specification.' });
  }
});

// ─── GET /ships/:shipId/specifications — Get specs for a specific ship ────────
router.get('/ships/:shipId/specifications', authenticateToken, async (req, res) => {
  try {
    const { shipId } = req.params;

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can view specifications.' });
    }
    const buyer_id = buyerProfile[0].id;

    // Verify ship belongs to this buyer
    const ship = await sql`SELECT id FROM buyer_ships WHERE id = ${shipId} AND buyer_id = ${buyer_id}`;
    if (ship.length === 0) {
      return res.status(404).json({ error: 'Ship not found.' });
    }

    const specs = await sql`
      SELECT id, equipment, manufacturer, model, created_at
      FROM buyer_specifications
      WHERE ship_id = ${shipId}
      ORDER BY id ASC
    `;

    res.json(specs);
  } catch (error) {
    console.error('Error fetching ship specifications:', error);
    res.status(500).json({ error: 'Internal server error while fetching specifications.' });
  }
});

// ─── GET /ships/:shipId/market-availability — Get market equipment & spare parts availability for a ship (JSON or CSV export)
router.get('/ships/:shipId/market-availability', authenticateToken, async (req, res) => {
  try {
    const { shipId } = req.params;
    const { format, type } = req.query; // format='csv' or default JSON; type='detailed' | 'summary'

    const buyerProfile = await sql`SELECT id FROM buyers WHERE user_id = ${req.user.id}`;
    if (buyerProfile.length === 0) {
      return res.status(403).json({ error: 'Only registered buyers can access ship market data.' });
    }
    const buyer_id = buyerProfile[0].id;

    // Verify ship belongs to this buyer
    const shipRows = await sql`
      SELECT id, ship_name, imo_number, ship_type, created_at
      FROM buyer_ships
      WHERE id = ${shipId} AND buyer_id = ${buyer_id}
    `;
    if (shipRows.length === 0) {
      return res.status(404).json({ error: 'Ship not found.' });
    }
    const ship = shipRows[0];

    // Fetch ship specifications
    const specs = await sql`
      SELECT id, equipment, manufacturer, model, created_at
      FROM buyer_specifications
      WHERE ship_id = ${shipId}
      ORDER BY id ASC
    `;

    // Fetch all market products from approved providers with stock > 0
    const marketProducts = await sql`
      SELECT p.*, pr.company_name, pr.contact_person, pr.email as provider_email, pr.phone as provider_phone
      FROM products p
      JOIN providers pr ON p.provider_id = pr.id
      ORDER BY p.category, p.product_name
    `;

    // Levenshtein & fuzzy match helpers
    const levenshtein = (a, b) => {
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const m = [];
      for (let i = 0; i <= b.length; i++) m[i] = [i];
      for (let j = 0; j <= a.length; j++) m[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) m[i][j] = m[i - 1][j - 1];
          else m[i][j] = Math.min(m[i - 1][j - 1] + 1, Math.min(m[i][j - 1] + 1, m[i - 1][j] + 1));
        }
      }
      return m[b.length][a.length];
    };

    const fuzzyMatch = (str, pattern) => {
      if (!pattern) return true;
      if (!str) return false;
      const s = String(str).toLowerCase().trim();
      const p = pattern.toLowerCase().trim();
      if (!s || !p) return false;
      if (s === p) return true;
      if (s.includes(p) || p.includes(s)) return true;
      const sWords = s.split(/[\s-]+/).filter(Boolean);
      const pWords = p.split(/[\s-]+/).filter(Boolean);
      if (!sWords.length || !pWords.length) return false;
      return pWords.every(pw => sWords.some(sw => {
        if (sw === pw) return true;
        if (sw.includes(pw) || pw.includes(sw)) return true;
        if (pw.length <= 4) return false;
        return levenshtein(sw, pw) <= 1;
      }));
    };

    // Check if a product matches equipment type (category/product_name)
    const matchesEquipment = (p, spec) => {
      if (!spec.equipment) return true;
      return fuzzyMatch(p.category, spec.equipment) || fuzzyMatch(p.product_name, spec.equipment);
    };

    // Check if a product fully matches spec (equipment + manufacturer + model)
    const matchesSpecFull = (p, spec) => {
      if (!matchesEquipment(p, spec)) return false;
      if (spec.manufacturer && spec.manufacturer.trim()) {
        const brandMatch = fuzzyMatch(p.brand, spec.manufacturer) || fuzzyMatch(p.product_name, spec.manufacturer);
        if (!brandMatch) return false;
      }
      if (spec.model && spec.model.trim()) {
        const modelMatch = fuzzyMatch(p.model_number, spec.model) || fuzzyMatch(p.product_name, spec.model);
        if (!modelMatch) return false;
      }
      return true;
    };

    // Calculate matches per specification with 3-tier classification
    let totalMarketListings = 0;
    let totalMarketQuantity = 0;
    let equipmentWithStockCount = 0;

    const equipmentBreakdown = specs.map(spec => {
      // Tier 1: Fully compatible products (equipment + manufacturer + model match)
      const compatibleProducts = marketProducts.filter(p => matchesSpecFull(p, spec));
      // Tier 2: Equipment type matches but different manufacturer/model — ONLY 'Complete Set' items qualify as compatible alternatives
      const equipmentOnlyProducts = marketProducts.filter(p => {
        if (!matchesEquipment(p, spec)) return false;
        // Exclude products already in compatible list
        if (compatibleProducts.some(cp => cp.id === p.id)) return false;
        // Only 'Complete Set' items can appear as compatible alternatives
        const cat = (p.part_category || '').trim().toLowerCase();
        if (cat !== 'complete set') return false;
        return true;
      });

      const compatibleQty = compatibleProducts.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      const equipmentOnlyQty = equipmentOnlyProducts.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      // Determine compatibility status
      let compatibility_status;
      let compatibility_reason;
      if (compatibleProducts.length > 0) {
        compatibility_status = 'compatible';
        compatibility_reason = 'Compatible match found for your specifications';
        equipmentWithStockCount++;
      } else if (equipmentOnlyProducts.length > 0) {
        compatibility_status = 'incompatible';
        compatibility_reason = 'Equipment available in market but with different manufacturer/model than your ship specifications';
      } else {
        compatibility_status = 'not_available';
        compatibility_reason = 'This equipment is not available in the market from any manufacturer or model';
      }

      totalMarketListings += compatibleProducts.length;
      totalMarketQuantity += compatibleQty;

      const formatProduct = (m) => ({
        id: m.id,
        product_name: m.product_name || m.category,
        part_number: m.part_number || '',
        brand: m.brand || '',
        model_number: m.model_number || '',
        category: m.category,
        quantity: Number(m.quantity) || 0,
        price: m.price || '0.00',
        location: m.location || '',
        service_type: m.service_type || 'Supply',
        department: m.department || ''
      });

      return {
        id: spec.id,
        equipment: spec.equipment,
        manufacturer: spec.manufacturer || '',
        model: spec.model || '',
        compatibility_status,
        compatibility_reason,
        available_listings_count: compatibleProducts.length,
        total_available_quantity: compatibleQty,
        equipment_only_listings_count: equipmentOnlyProducts.length,
        equipment_only_total_quantity: equipmentOnlyQty,
        status: compatibleQty > 0 ? 'In Stock' : (equipmentOnlyQty > 0 ? 'Available (Different Specs)' : 'Not Available in Market'),
        products: compatibleProducts.map(formatProduct),
        equipment_only_products: equipmentOnlyProducts.map(formatProduct)
      };
    });

    // Check if CSV export is requested
    if (format === 'csv') {
      const escapeCell = (val) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      let csvRows = [];
      const sanitizedShipName = (ship.ship_name || 'Ship').replace(/[^a-zA-Z0-9_-]/g, '_');

      if (type === 'summary') {
        const headers = [
          'Ship Name',
          'Ship IMO',
          'Ship Type',
          'Ship Equipment',
          'Specified Manufacturer',
          'Specified Model',
          'Compatibility Status',
          'Compatibility Reason',
          'Compatible Listings Count',
          'Compatible Total Quantity (Units)',
          'Alternative Listings Count (Different Specs)',
          'Alternative Total Quantity (Units)',
          'Market Availability Status'
        ];
        csvRows.push(headers.map(escapeCell).join(','));

        for (const eq of equipmentBreakdown) {
          csvRows.push([
            ship.ship_name,
            ship.imo_number || 'N/A',
            ship.ship_type || 'N/A',
            eq.equipment,
            eq.manufacturer || 'N/A',
            eq.model || 'N/A',
            eq.compatibility_status === 'compatible' ? 'COMPATIBLE' : (eq.compatibility_status === 'incompatible' ? 'DIFFERENT SPECS IN MARKET' : 'NOT AVAILABLE IN MARKET'),
            eq.compatibility_reason,
            eq.available_listings_count,
            eq.total_available_quantity,
            eq.equipment_only_listings_count,
            eq.equipment_only_total_quantity,
            eq.status
          ].map(escapeCell).join(','));
        }
      } else {
        // Detailed inventory CSV (default)
        const headers = [
          'Ship Name',
          'Ship IMO',
          'Ship Type',
          'Ship Equipment',
          'Specified Manufacturer',
          'Specified Model',
          'Compatibility Status',
          'Compatibility Reason',
          'Match Type',
          'Equipment Market Listings Count',
          'Equipment Total Units Available',
          'Market Part / Product Name',
          'Part Number',
          'Market Brand',
          'Market Model Number',
          'Available Quantity in Market',
          'Unit Price (USD)',
          'Stock Location',
          'Service Type',
          'Market Availability Status'
        ];
        csvRows.push(headers.map(escapeCell).join(','));

        for (const eq of equipmentBreakdown) {
          const compatStatusLabel = eq.compatibility_status === 'compatible' ? 'COMPATIBLE' : (eq.compatibility_status === 'incompatible' ? 'DIFFERENT SPECS IN MARKET' : 'NOT AVAILABLE IN MARKET');

          if (eq.products.length > 0) {
            // Compatible products
            for (const p of eq.products) {
              csvRows.push([
                ship.ship_name,
                ship.imo_number || 'N/A',
                ship.ship_type || 'N/A',
                eq.equipment,
                eq.manufacturer || 'N/A',
                eq.model || 'N/A',
                compatStatusLabel,
                eq.compatibility_reason,
                'Exact Compatible Match',
                eq.available_listings_count,
                eq.total_available_quantity,
                p.product_name,
                p.part_number || 'N/A',
                p.brand || 'N/A',
                p.model_number || 'N/A',
                p.quantity,
                p.price,
                p.location || 'N/A',
                p.service_type || 'Supply',
                'Compatible - Available in Market'
              ].map(escapeCell).join(','));
            }
          }

          if (eq.equipment_only_products.length > 0) {
            // Equipment-only products (different manufacturer/model)
            for (const p of eq.equipment_only_products) {
              csvRows.push([
                ship.ship_name,
                ship.imo_number || 'N/A',
                ship.ship_type || 'N/A',
                eq.equipment,
                eq.manufacturer || 'N/A',
                eq.model || 'N/A',
                compatStatusLabel,
                eq.compatibility_reason,
                'Alternative (Different Manufacturer/Model)',
                eq.equipment_only_listings_count,
                eq.equipment_only_total_quantity,
                p.product_name,
                p.part_number || 'N/A',
                p.brand || 'N/A',
                p.model_number || 'N/A',
                p.quantity,
                p.price,
                p.location || 'N/A',
                p.service_type || 'Supply',
                'Alternative - Different Specs Available'
              ].map(escapeCell).join(','));
            }
          }

          if (eq.products.length === 0 && eq.equipment_only_products.length === 0) {
            // Equipment has no listings at all in market
            csvRows.push([
              ship.ship_name,
              ship.imo_number || 'N/A',
              ship.ship_type || 'N/A',
              eq.equipment,
              eq.manufacturer || 'N/A',
              eq.model || 'N/A',
              'NOT AVAILABLE IN MARKET',
              'This equipment is not available in the market from any manufacturer or model',
              'No Match',
              0,
              0,
              'No spare parts currently listed in market',
              'N/A',
              'N/A',
              'N/A',
              0,
              'N/A',
              'N/A',
              'N/A',
              'Not Available in Market'
            ].map(escapeCell).join(','));
          }
        }
      }

      const csvContent = csvRows.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedShipName}_market_inventory.csv"`);
      return res.status(200).send(csvContent);
    }

    // Return structured JSON
    res.json({
      ship,
      summary: {
        total_equipment: specs.length,
        equipment_with_stock: equipmentWithStockCount,
        equipment_incompatible: equipmentBreakdown.filter(e => e.compatibility_status === 'incompatible').length,
        equipment_not_available: equipmentBreakdown.filter(e => e.compatibility_status === 'not_available').length,
        equipment_out_of_stock: specs.length - equipmentWithStockCount,
        total_market_listings: totalMarketListings,
        total_market_quantity: totalMarketQuantity
      },
      equipment: equipmentBreakdown
    });
  } catch (error) {
    console.error('Error fetching ship market availability:', error);
    res.status(500).json({ error: 'Internal server error while fetching ship market data.' });
  }
});

export default router;


