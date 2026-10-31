import { Router } from 'express';
import { sql } from '../db.js';
import { authenticateToken, authenticateAdmin } from '../middleware/auth.js';
import { overviewHandler } from './management.js';
import { getWalletSettings, updateWalletSettings, getWallet, getTransactions, creditWallet, debitWallet } from '../utils/wallet.js';

const router = Router();

// Every admin endpoint exposes sensitive account data — admin login is required for all of them
router.use(authenticateToken, authenticateAdmin);

// Platform overview (same KPIs and trends as the management console)
router.get('/overview', overviewHandler);

// ─── Users & access ─────────────────────────────────────────────────────────────
// Every login account with contact details, approval state and session activity
router.get('/users', async (req, res) => {
  try {
    const users = await sql`
      SELECT u.id, u.username, u.role, u.created_at, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip,
             COALESCE(b.email, p.email) AS email,
             COALESCE(b.phone, p.phone) AS phone,
             COALESCE(b.status, p.status, 'approved') AS status,
             COALESCE(b.email_verified_at, p.email_verified_at) AS email_verified_at,
             p.company_name,
             (SELECT MAX(s.last_active) FROM user_sessions s WHERE s.user_id = u.id) AS last_seen,
             (SELECT COUNT(*)::int FROM user_sessions s WHERE s.user_id = u.id
                AND s.last_active > NOW() - INTERVAL '2 minutes 30 seconds') AS active_sessions
      FROM users u
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true
      LEFT JOIN buyers b ON b.user_id = u.id
      LEFT JOIN providers p ON p.user_id = u.id
      ORDER BY u.created_at DESC
    `;
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Permanently delete a buyer / seller account and every record it owns.
// Deletes are explicit (not left to ON DELETE CASCADE) so older databases whose
// foreign keys were created without cascades are wiped just as completely.
// Terms & Conditions acceptance records are kept as legal evidence, unlinked from the account.
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });
    if (userId === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

    const [user] = await sql`SELECT id, username, role FROM users WHERE id = ${userId}`;
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.role === 'admin' || user.role === 'management') {
      return res.status(403).json({ error: 'Admin and management accounts cannot be deleted here' });
    }

    const [counts] = await sql`
      WITH b AS (SELECT id FROM buyers WHERE user_id = ${userId}),
           p AS (SELECT id FROM providers WHERE user_id = ${userId})
      SELECT (SELECT COUNT(*)::int FROM products WHERE provider_id IN (SELECT id FROM p)) AS products,
             (SELECT COUNT(*)::int FROM inquiries WHERE buyer_id IN (SELECT id FROM b) OR provider_id IN (SELECT id FROM p)) AS inquiries,
             (SELECT COUNT(*)::int FROM buyer_ships WHERE buyer_id IN (SELECT id FROM b)) AS ships,
             (SELECT COUNT(*)::int FROM buyer_specifications WHERE buyer_id IN (SELECT id FROM b)) AS parts
    `;

    await sql.transaction([
      sql`DELETE FROM buyer_searches
          WHERE buyer_id IN (SELECT id FROM buyers WHERE user_id = ${userId})
             OR product_id IN (SELECT pr.id FROM products pr JOIN providers p ON p.id = pr.provider_id WHERE p.user_id = ${userId})`,
      sql`DELETE FROM inquiries
          WHERE buyer_id IN (SELECT id FROM buyers WHERE user_id = ${userId})
             OR provider_id IN (SELECT id FROM providers WHERE user_id = ${userId})
             OR product_id IN (SELECT pr.id FROM products pr JOIN providers p ON p.id = pr.provider_id WHERE p.user_id = ${userId})`,
      sql`DELETE FROM buyer_specifications WHERE buyer_id IN (SELECT id FROM buyers WHERE user_id = ${userId})`,
      sql`DELETE FROM buyer_ships WHERE buyer_id IN (SELECT id FROM buyers WHERE user_id = ${userId})`,
      sql`DELETE FROM products WHERE provider_id IN (SELECT id FROM providers WHERE user_id = ${userId})`,
      sql`DELETE FROM email_otps
          WHERE LOWER(email) IN (SELECT LOWER(email) FROM buyers WHERE user_id = ${userId}
                                 UNION SELECT LOWER(email) FROM providers WHERE user_id = ${userId})`,
      sql`DELETE FROM buyers WHERE user_id = ${userId}`,
      sql`DELETE FROM providers WHERE user_id = ${userId}`,
      sql`DELETE FROM user_sessions WHERE user_id = ${userId}`,
      sql`DELETE FROM password_resets WHERE user_id = ${userId}`,
      sql`DELETE FROM wallet_transactions WHERE user_id = ${userId}`,
      sql`DELETE FROM wallets WHERE user_id = ${userId}`,
      sql`UPDATE terms_acceptances SET user_id = NULL WHERE user_id = ${userId}`,
      sql`DELETE FROM users WHERE id = ${userId}`,
    ]);

    console.log(`🗑️  Admin @${req.user.username} deleted account @${user.username} (id ${userId})`, counts);
    res.json({ message: `Account @${user.username} and all its data were deleted`, deleted: counts });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ─── Resellers & wallets ────────────────────────────────────────────────────────
router.get('/resellers', async (req, res) => {
  try {
    const [rows, settings] = await Promise.all([sql`
      SELECT u.id AS user_id, u.username, u.created_at, b.id AS buyer_id, b.email, b.phone, b.country, b.status,
             COALESCE(w.balance, 0)::float AS balance, w.activated_at,
             COALESCE(t.recharged, 0)::float AS total_recharged,
             COALESCE(t.spent, 0)::float AS total_spent,
             COALESCE(t.enquiries, 0)::int AS enquiries_paid,
             t.last_tx,
             (SELECT MAX(s.last_active) FROM user_sessions s WHERE s.user_id = u.id) AS last_seen
      FROM users u
      LEFT JOIN buyers b ON b.user_id = u.id
      LEFT JOIN wallets w ON w.user_id = u.id
      LEFT JOIN (
        SELECT user_id,
               SUM(amount) FILTER (WHERE type = 'credit' AND source IN ('razorpay', 'admin')) AS recharged,
               SUM(amount) FILTER (WHERE type = 'debit' AND source = 'enquiry') -
                 COALESCE(SUM(amount) FILTER (WHERE type = 'credit' AND source = 'refund'), 0) AS spent,
               COUNT(*) FILTER (WHERE type = 'debit' AND source = 'enquiry') -
                 COUNT(*) FILTER (WHERE type = 'credit' AND source = 'refund') AS enquiries,
               MAX(created_at) AS last_tx
        FROM wallet_transactions GROUP BY user_id
      ) t ON t.user_id = u.id
      WHERE u.role = 'reseller'
      ORDER BY u.created_at DESC
    `, getWalletSettings()]);
    res.json({ resellers: rows, settings });
  } catch (error) {
    console.error('Error fetching resellers:', error);
    res.status(500).json({ error: 'Failed to fetch resellers' });
  }
});

router.get('/resellers/:userId/wallet', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const [user] = await sql`SELECT id, username FROM users WHERE id = ${userId} AND role = 'reseller'`;
    if (!user) return res.status(404).json({ error: 'Reseller not found' });
    const [wallet, transactions] = await Promise.all([getWallet(userId), getTransactions(userId, 200)]);
    res.json({ user, wallet, transactions });
  } catch (error) {
    console.error('Error fetching reseller wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Manual top-up (offline payment) or correction. type: 'credit' | 'debit'
router.post('/resellers/:userId/wallet', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { type, note } = req.body;
    const amount = Number(req.body.amount);
    if (!['credit', 'debit'].includes(type)) return res.status(400).json({ error: 'Type must be credit or debit' });
    if (!(amount > 0) || amount > 1000000) return res.status(400).json({ error: 'Enter an amount between ₹1 and ₹10,00,000' });
    if (!note || !String(note).trim()) return res.status(400).json({ error: 'A note is required (e.g. bank transfer reference)' });

    const [user] = await sql`SELECT id, username FROM users WHERE id = ${userId} AND role = 'reseller'`;
    if (!user) return res.status(404).json({ error: 'Reseller not found' });

    const cleanNote = `${String(note).trim().slice(0, 300)} (by @${req.user.username})`;
    if (type === 'credit') {
      await creditWallet({ userId, amount, source: 'admin', note: cleanNote, createdBy: req.user.id });
    } else {
      const result = await debitWallet({ userId, amount, source: 'admin', note: cleanNote, createdBy: req.user.id, requireActivated: false });
      if (!result.ok) return res.status(400).json({ error: `Cannot deduct more than the current balance (₹${result.wallet.balance}).` });
    }
    const wallet = await getWallet(userId);
    res.json({ message: `Wallet ${type === 'credit' ? 'credited' : 'debited'} ₹${amount} for @${user.username}`, wallet });
  } catch (error) {
    console.error('Error adjusting wallet:', error);
    res.status(500).json({ error: 'Failed to update wallet' });
  }
});

router.get('/wallet-settings', async (req, res) => {
  try {
    res.json(await getWalletSettings());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load wallet settings' });
  }
});

router.put('/wallet-settings', async (req, res) => {
  try {
    const settings = await updateWalletSettings(req.body || {});
    console.log(`⚙️  Wallet settings updated by @${req.user.username}:`, settings);
    res.json({ message: 'Wallet settings saved', settings });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to save wallet settings' });
  }
});

// ─── Sellers ────────────────────────────────────────────────────────────────────
const getSellers = async (req, res) => {
  try {
    const sellers = await sql`
      SELECT p.*, u.username, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip,
             COALESCE(stock.product_count, 0) AS product_count,
             COALESCE(stock.units, 0) AS units,
             COALESCE(stock.inventory_value, 0) AS inventory_value,
             COALESCE(stock.category_count, 0) AS category_count,
             COALESCE(inq.total, 0) AS inquiry_count,
             COALESCE(inq.accepted, 0) AS accepted_count,
             COALESCE(inq.pending, 0) AS pending_count,
             (SELECT MAX(s.last_active) FROM user_sessions s WHERE s.user_id = u.id) AS last_seen
      FROM providers p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true
      LEFT JOIN (
        SELECT provider_id, COUNT(*)::int AS product_count, COALESCE(SUM(quantity), 0)::int AS units,
               COALESCE(SUM(price * quantity), 0)::float AS inventory_value,
               COUNT(DISTINCT category)::int AS category_count
        FROM products GROUP BY provider_id
      ) stock ON stock.provider_id = p.id
      LEFT JOIN (
        SELECT provider_id, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
               COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
        FROM inquiries GROUP BY provider_id
      ) inq ON inq.provider_id = p.id
      ORDER BY p.created_at DESC
    `;
    res.json(sellers);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Failed to fetch sellers' });
  }
};

router.get('/sellers', getSellers);
router.get('/providers', getSellers);

// Full seller profile: listings and inquiries received
router.get('/sellers/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [profile] = await sql`
      SELECT p.*, u.username, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip,
             (SELECT MAX(s.last_active) FROM user_sessions s WHERE s.user_id = u.id) AS last_seen
      FROM providers p JOIN users u ON u.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true WHERE p.id = ${id}
    `;
    if (!profile) return res.status(404).json({ error: 'Seller not found' });

    const [products, inquiries] = await Promise.all([
      sql`
        SELECT pr.id, pr.product_name, pr.part_number, pr.brand, pr.model_number, pr.category,
               pr.equipment_condition, pr.price, pr.quantity, pr.location, pr.created_at,
               (SELECT COUNT(*)::int FROM inquiries i WHERE i.product_id = pr.id) AS inquiry_count
        FROM products pr WHERE pr.provider_id = ${id}
        ORDER BY inquiry_count DESC, pr.created_at DESC
      `,
      sql`
        SELECT i.id, i.status, i.target_price, i.destination_location, i.vessel_name, i.created_at,
               pr.product_name, ub.username AS buyer_username, b.email AS buyer_email
        FROM inquiries i
        LEFT JOIN products pr ON pr.id = i.product_id
        LEFT JOIN buyers b ON b.id = i.buyer_id
        LEFT JOIN users ub ON ub.id = b.user_id
        WHERE i.provider_id = ${id}
        ORDER BY i.created_at DESC LIMIT 200
      `,
    ]);
    res.json({ profile, products, inquiries });
  } catch (error) {
    console.error('Error fetching seller detail:', error);
    res.status(500).json({ error: 'Failed to fetch seller' });
  }
});

// ─── Buyers ─────────────────────────────────────────────────────────────────────
router.get('/buyers', async (req, res) => {
  try {
    const buyers = await sql`
      SELECT b.*, u.username, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip,
             COALESCE(fleet.ship_count, 0) AS ship_count,
             COALESCE(parts.part_count, 0) AS part_count,
             COALESCE(parts.equipment_count, 0) AS equipment_count,
             COALESCE(inq.total, 0) AS inquiry_count,
             COALESCE(inq.accepted, 0) AS accepted_count,
             (SELECT COUNT(*)::int FROM buyer_searches s WHERE s.buyer_id = b.id) AS search_count,
             (SELECT MAX(s.last_active) FROM user_sessions s WHERE s.user_id = u.id) AS last_seen
      FROM buyers b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true
      LEFT JOIN (SELECT buyer_id, COUNT(*)::int AS ship_count FROM buyer_ships GROUP BY buyer_id) fleet ON fleet.buyer_id = b.id
      LEFT JOIN (
        SELECT buyer_id, COUNT(*)::int AS part_count, COUNT(DISTINCT LOWER(TRIM(equipment)))::int AS equipment_count
        FROM buyer_specifications GROUP BY buyer_id
      ) parts ON parts.buyer_id = b.id
      LEFT JOIN (
        SELECT buyer_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted
        FROM inquiries GROUP BY buyer_id
      ) inq ON inq.buyer_id = b.id
      ORDER BY b.created_at DESC
    `;
    res.json(buyers);
  } catch (error) {
    console.error('Error fetching buyers:', error);
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
});

// Full buyer profile: fleet with every recorded part, inquiries and recent searches
router.get('/buyers/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [profile] = await sql`
      SELECT b.*, u.username, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip,
             (SELECT MAX(s.last_active) FROM user_sessions s WHERE s.user_id = u.id) AS last_seen
      FROM buyers b JOIN users u ON u.id = b.user_id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true WHERE b.id = ${id}
    `;
    if (!profile) return res.status(404).json({ error: 'Buyer not found' });

    const [ships, parts, inquiries, searches] = await Promise.all([
      sql`SELECT id, ship_name, imo_number, ship_type, created_at FROM buyer_ships WHERE buyer_id = ${id} ORDER BY created_at`,
      sql`SELECT id, ship_id, equipment, manufacturer, model, created_at FROM buyer_specifications WHERE buyer_id = ${id} ORDER BY equipment`,
      sql`
        SELECT i.id, i.status, i.target_price, i.destination_location, i.vessel_name, i.created_at,
               pr.product_name, pr.part_number, p.company_name AS seller_company
        FROM inquiries i
        LEFT JOIN products pr ON pr.id = i.product_id
        LEFT JOIN providers p ON p.id = i.provider_id
        WHERE i.buyer_id = ${id}
        ORDER BY i.created_at DESC LIMIT 200
      `,
      sql`
        SELECT s.search_query, s.created_at, pr.product_name, pr.part_number
        FROM buyer_searches s LEFT JOIN products pr ON pr.id = s.product_id
        WHERE s.buyer_id = ${id}
        ORDER BY s.created_at DESC LIMIT 50
      `,
    ]);

    const fleet = ships.map(ship => ({ ...ship, parts: parts.filter(p => p.ship_id === ship.id) }));
    const unassigned = parts.filter(p => !ships.some(s => s.id === p.ship_id));
    res.json({ profile, fleet, unassignedParts: unassigned, inquiries, searches });
  } catch (error) {
    console.error('Error fetching buyer detail:', error);
    res.status(500).json({ error: 'Failed to fetch buyer' });
  }
});

// Flat registry of every part on every buyer vessel (for search / export)
router.get('/fleet-parts', async (req, res) => {
  try {
    const rows = await sql`
      SELECT bs.id, bs.equipment, bs.manufacturer, bs.model, bs.created_at,
             s.ship_name, s.imo_number, s.ship_type,
             b.id AS buyer_id, u.username AS buyer_username, b.email AS buyer_email, b.country AS buyer_country
      FROM buyer_specifications bs
      JOIN buyers b ON b.id = bs.buyer_id
      JOIN users u ON u.id = b.user_id
      LEFT JOIN buyer_ships s ON s.id = bs.ship_id
      ORDER BY bs.created_at DESC
      LIMIT 5000
    `;
    res.json(rows);
  } catch (error) {
    console.error('Error fetching fleet parts:', error);
    res.status(500).json({ error: 'Failed to fetch fleet parts' });
  }
});

// ─── Parts intelligence ─────────────────────────────────────────────────────────
// Demand = parts recorded on buyers' vessels (installed base) + inquiries + searches.
// Supply = matching product listings. Equipment names are grouped case-insensitively.
router.get('/parts-intelligence', async (req, res) => {
  try {
    const [summary, equipment, manufacturers, models, shipTypes, trendingProducts, risingEquipment, partsTrend, inquiryCategories] = await Promise.all([
      sql`
        SELECT (SELECT COUNT(*)::int FROM buyer_ships) AS ships,
               (SELECT COUNT(*)::int FROM buyer_specifications) AS parts,
               (SELECT COUNT(DISTINCT LOWER(TRIM(equipment)))::int FROM buyer_specifications) AS equipment_types,
               (SELECT COUNT(DISTINCT buyer_id)::int FROM buyer_ships) AS buyers_with_fleet,
               (SELECT COUNT(*)::int FROM buyer_searches WHERE created_at > NOW() - INTERVAL '7 days') AS searches_7d,
               (SELECT COUNT(*)::int FROM inquiries WHERE created_at > NOW() - INTERVAL '30 days') AS inquiries_30d
      `,
      sql`
        WITH eq AS (
          SELECT LOWER(TRIM(equipment)) AS k, MIN(TRIM(equipment)) AS label,
                 COUNT(*)::int AS records, COUNT(DISTINCT buyer_id)::int AS buyers,
                 COUNT(DISTINCT ship_id)::int AS ships,
                 COUNT(DISTINCT LOWER(TRIM(manufacturer)))::int AS manufacturers,
                 MAX(created_at) AS last_added
          FROM buyer_specifications
          WHERE TRIM(equipment) <> ''
          GROUP BY 1
        )
        SELECT eq.*,
               (SELECT COUNT(*)::int FROM products p
                 WHERE POSITION(eq.k IN LOWER(p.product_name)) > 0 OR POSITION(eq.k IN LOWER(COALESCE(p.category, ''))) > 0) AS listings,
               (SELECT COALESCE(SUM(p.quantity), 0)::int FROM products p
                 WHERE POSITION(eq.k IN LOWER(p.product_name)) > 0 OR POSITION(eq.k IN LOWER(COALESCE(p.category, ''))) > 0) AS units
        FROM eq
        ORDER BY ships DESC, records DESC, label
      `,
      sql`
        SELECT MIN(TRIM(manufacturer)) AS label, COUNT(*)::int AS records,
               COUNT(DISTINCT buyer_id)::int AS buyers, COUNT(DISTINCT ship_id)::int AS ships
        FROM buyer_specifications
        WHERE manufacturer IS NOT NULL AND TRIM(manufacturer) <> ''
        GROUP BY LOWER(TRIM(manufacturer))
        ORDER BY ships DESC, records DESC LIMIT 12
      `,
      sql`
        SELECT MIN(TRIM(equipment)) AS equipment, MIN(TRIM(manufacturer)) AS manufacturer, MIN(TRIM(model)) AS model,
               COUNT(DISTINCT ship_id)::int AS ships, COUNT(DISTINCT buyer_id)::int AS buyers
        FROM buyer_specifications
        WHERE model IS NOT NULL AND TRIM(model) <> ''
        GROUP BY LOWER(TRIM(equipment)), LOWER(TRIM(COALESCE(manufacturer, ''))), LOWER(TRIM(model))
        ORDER BY ships DESC, buyers DESC LIMIT 15
      `,
      sql`
        SELECT COALESCE(NULLIF(TRIM(s.ship_type), ''), 'Unspecified') AS ship_type,
               COUNT(DISTINCT s.id)::int AS ships, COUNT(bs.id)::int AS parts
        FROM buyer_ships s LEFT JOIN buyer_specifications bs ON bs.ship_id = s.id
        GROUP BY 1 ORDER BY ships DESC
      `,
      sql`
        SELECT p.id, p.product_name, p.part_number, p.brand, p.category, p.quantity, pr.company_name,
               COUNT(i.id) FILTER (WHERE i.created_at > NOW() - INTERVAL '30 days')::int AS inquiries_30d,
               COUNT(i.id) FILTER (WHERE i.created_at <= NOW() - INTERVAL '30 days' AND i.created_at > NOW() - INTERVAL '60 days')::int AS inquiries_prev,
               COUNT(DISTINCT i.buyer_id)::int AS buyers,
               (SELECT COUNT(*)::int FROM buyer_searches s WHERE s.product_id = p.id AND s.created_at > NOW() - INTERVAL '7 days') AS searches_7d
        FROM products p
        JOIN providers pr ON pr.id = p.provider_id
        LEFT JOIN inquiries i ON i.product_id = p.id
        GROUP BY p.id, pr.company_name
        HAVING COUNT(i.id) FILTER (WHERE i.created_at > NOW() - INTERVAL '30 days') > 0
            OR (SELECT COUNT(*) FROM buyer_searches s WHERE s.product_id = p.id AND s.created_at > NOW() - INTERVAL '7 days') > 0
        ORDER BY inquiries_30d DESC, searches_7d DESC
        LIMIT 15
      `,
      sql`
        SELECT MIN(TRIM(equipment)) AS label, COUNT(*)::int AS added, COUNT(DISTINCT ship_id)::int AS ships
        FROM buyer_specifications
        WHERE created_at > NOW() - INTERVAL '30 days' AND TRIM(equipment) <> ''
        GROUP BY LOWER(TRIM(equipment))
        ORDER BY added DESC LIMIT 10
      `,
      sql`
        SELECT d::date AS day,
               (SELECT COUNT(*)::int FROM buyer_specifications bs WHERE bs.created_at::date = d::date) AS count
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d
        ORDER BY d
      `,
      sql`
        SELECT COALESCE(NULLIF(p.category, ''), 'Uncategorised') AS category, COUNT(*)::int AS count
        FROM inquiries i JOIN products p ON p.id = i.product_id
        GROUP BY 1 ORDER BY count DESC LIMIT 8
      `,
    ]);

    res.json({
      summary: summary[0],
      topEquipment: equipment.slice(0, 15),
      // High installed base but nothing (or almost nothing) listed — sourcing opportunities for sellers
      supplyGaps: equipment.filter(e => e.listings === 0).slice(0, 10),
      topManufacturers: manufacturers,
      topModels: models,
      shipTypes,
      trendingProducts,
      risingEquipment,
      partsTrend,
      inquiryCategories,
    });
  } catch (error) {
    console.error('Error fetching parts intelligence:', error);
    res.status(500).json({ error: 'Failed to fetch parts intelligence' });
  }
});

// ─── Inquiries ──────────────────────────────────────────────────────────────────
router.get('/inquiries', async (req, res) => {
  try {
    const inquiries = await sql`
      SELECT i.*,
             p.product_name, p.category, p.part_number,
             pr.company_name AS vendor_company, u_vendor.username AS vendor_username, pr.email AS vendor_email,
             b.email AS buyer_email, u_buyer.username AS buyer_username
      FROM inquiries i
      LEFT JOIN products p ON i.product_id = p.id
      LEFT JOIN providers pr ON i.provider_id = pr.id
      LEFT JOIN users u_vendor ON pr.user_id = u_vendor.id
      LEFT JOIN buyers b ON i.buyer_id = b.id
      LEFT JOIN users u_buyer ON b.user_id = u_buyer.id
      ORDER BY i.created_at DESC
    `;
    res.json(inquiries);
  } catch (error) {
    console.error('Error fetching admin inquiries:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

// Basic platform statistics (kept for backward compatibility)
router.get('/stats', async (req, res) => {
  try {
    const usersCount = await sql`SELECT COUNT(*) FROM users`;
    const providersCount = await sql`SELECT COUNT(*) FROM providers`;
    const productsCount = await sql`SELECT COUNT(*) FROM products`;
    const inquiriesCount = await sql`SELECT COUNT(*) FROM inquiries`;

    res.json({
      totalUsers: parseInt(usersCount[0].count),
      totalSellers: parseInt(providersCount[0].count),
      totalProviders: parseInt(providersCount[0].count),
      totalProducts: parseInt(productsCount[0].count),
      totalInquiries: parseInt(inquiriesCount[0].count),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
