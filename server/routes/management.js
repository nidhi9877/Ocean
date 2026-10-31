import { Router } from 'express';
import { sql } from '../db.js';
import { authenticateToken, authenticateManagement, authenticateAdminOrManagement } from '../middleware/auth.js';
import { sendAccountStatusEmail } from '../utils/email.js';

const router = Router();
const guard = [authenticateToken, authenticateAdminOrManagement];

// GET all pending sellers / providers
const getPendingSellers = async (req, res) => {
  try {
    const pendingProviders = await sql`
      SELECT p.*, u.username, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip
      FROM providers p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
    `;
    res.json(pendingProviders);
  } catch (error) {
    console.error('Error fetching pending sellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.get('/pending-sellers', ...guard, getPendingSellers);
router.get('/pending-providers', ...guard, getPendingSellers);

// GET all pending buyers
router.get('/pending-buyers', ...guard, async (req, res) => {
  try {
    const buyers = await sql`
      SELECT b.id, b.email, b.phone, b.country, b.status, b.created_at, u.username, u.role, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip
      FROM buyers b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true
      WHERE b.status = 'pending'
      ORDER BY b.created_at DESC
    `;
    res.json(buyers);
  } catch (error) {
    console.error('Error fetching pending buyers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all sellers (all statuses) with activity counts
router.get('/all-sellers', ...guard, async (req, res) => {
  try {
    const sellers = await sql`
      SELECT p.id, p.company_name, p.contact_person, p.email, p.phone,
             p.address, p.city, p.country, p.description, p.payment_mode,
             p.status, p.created_at, p.reviewed_at, u.username, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip,
             (SELECT COUNT(*)::int FROM products pr WHERE pr.provider_id = p.id) AS product_count,
             (SELECT COUNT(*)::int FROM inquiries i WHERE i.provider_id = p.id) AS inquiry_count
      FROM providers p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true
      ORDER BY p.created_at DESC
    `;
    res.json(sellers);
  } catch (error) {
    console.error('Error fetching all sellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all buyers with activity counts
router.get('/all-buyers', ...guard, async (req, res) => {
  try {
    const buyers = await sql`
      SELECT b.id, b.email, b.phone, b.country, b.imo_number,
             b.ship_name, b.ship_type, b.status, b.created_at, b.reviewed_at, u.username, u.role, terms.terms_version, terms.accepted_at AS terms_accepted_at, terms.ip_address AS terms_ip,
             (SELECT COUNT(*)::int FROM inquiries i WHERE i.buyer_id = b.id) AS inquiry_count,
             (SELECT COUNT(*)::int FROM buyer_ships s WHERE s.buyer_id = b.id) AS ship_count
      FROM buyers b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT ta.terms_version, ta.accepted_at, ta.ip_address FROM terms_acceptances ta
        WHERE ta.user_id = u.id ORDER BY ta.accepted_at DESC LIMIT 1
      ) terms ON true
      ORDER BY b.created_at DESC
    `;
    res.json(buyers);
  } catch (error) {
    console.error('Error fetching all buyers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET recent inquiries across the marketplace
router.get('/inquiries', ...guard, async (req, res) => {
  try {
    const inquiries = await sql`
      SELECT i.id, i.status, i.target_price, i.destination_location, i.vessel_name, i.created_at,
             pr.product_name, pr.part_number, pr.brand,
             p.company_name AS seller_company,
             ub.username AS buyer_username, b.country AS buyer_country
      FROM inquiries i
      LEFT JOIN products pr ON pr.id = i.product_id
      LEFT JOIN providers p ON p.id = i.provider_id
      LEFT JOIN buyers b ON b.id = i.buyer_id
      LEFT JOIN users ub ON ub.id = b.user_id
      ORDER BY i.created_at DESC
      LIMIT 500
    `;
    res.json(inquiries);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET Terms & Conditions acceptance log — legal evidence of who accepted which version, when and from where
router.get('/terms-acceptances', ...guard, async (req, res) => {
  try {
    const rows = await sql`
      SELECT ta.id, ta.user_id, ta.username, ta.role, ta.email, ta.terms_version, ta.content_hash,
             ta.accepted_at, ta.ip_address, ta.user_agent,
             p.company_name,
             COALESCE(b.status, p.status) AS status
      FROM terms_acceptances ta
      LEFT JOIN buyers b ON b.user_id = ta.user_id
      LEFT JOIN providers p ON p.user_id = ta.user_id
      ORDER BY ta.accepted_at DESC
      LIMIT 5000
    `;
    res.json(rows);
  } catch (error) {
    console.error('Error fetching terms acceptances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET platform stats (kept for backward compatibility)
router.get('/stats', ...guard, async (req, res) => {
  try {
    const [ts, ps, as2, rs, tb, ti] = await Promise.all([
      sql`SELECT COUNT(*) FROM providers`,
      sql`SELECT COUNT(*) FROM providers WHERE status = 'pending'`,
      sql`SELECT COUNT(*) FROM providers WHERE status = 'approved'`,
      sql`SELECT COUNT(*) FROM providers WHERE status = 'rejected'`,
      sql`SELECT COUNT(*) FROM buyers`,
      sql`SELECT COUNT(*) FROM inquiries`,
    ]);
    res.json({
      totalSellers: parseInt(ts[0].count),
      pendingSellers: parseInt(ps[0].count),
      approvedSellers: parseInt(as2[0].count),
      rejectedSellers: parseInt(rs[0].count),
      totalBuyers: parseInt(tb[0].count),
      totalInquiries: parseInt(ti[0].count),
    });
  } catch (error) {
    console.error('Error fetching management stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET executive overview — KPIs, 30-day trends, breakdowns and activity feed
// (also served to admins at /api/admin/overview)
export const overviewHandler = async (req, res) => {
  try {
    const [
      sellerStatus, buyerStatus, inquiryStatus, catalog, sessions,
      inquiryWindows, signupWindows, signupTrend, inquiryTrend,
      topCountries, topSellers, topCategories, recentActivity,
    ] = await Promise.all([
      sql`SELECT status, COUNT(*)::int AS count FROM providers GROUP BY status`,
      sql`SELECT status, COUNT(*)::int AS count FROM buyers GROUP BY status`,
      sql`SELECT status, COUNT(*)::int AS count FROM inquiries GROUP BY status`,
      sql`SELECT COUNT(*)::int AS products, COALESCE(SUM(quantity), 0)::bigint AS units,
                 COALESCE(SUM(price * quantity), 0)::float AS inventory_value
          FROM products`,
      sql`SELECT COUNT(DISTINCT user_id)::int AS online FROM user_sessions
          WHERE last_active > NOW() - INTERVAL '2 minutes 30 seconds'`,
      sql`SELECT
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS current,
            COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '30 days' AND created_at > NOW() - INTERVAL '60 days')::int AS previous
          FROM inquiries`,
      sql`SELECT
            (SELECT COUNT(*) FROM buyers WHERE created_at > NOW() - INTERVAL '30 days')::int
              + (SELECT COUNT(*) FROM providers WHERE created_at > NOW() - INTERVAL '30 days')::int AS current,
            (SELECT COUNT(*) FROM buyers WHERE created_at <= NOW() - INTERVAL '30 days' AND created_at > NOW() - INTERVAL '60 days')::int
              + (SELECT COUNT(*) FROM providers WHERE created_at <= NOW() - INTERVAL '30 days' AND created_at > NOW() - INTERVAL '60 days')::int AS previous`,
      sql`SELECT d::date AS day,
                 (SELECT COUNT(*)::int FROM buyers b WHERE b.created_at::date = d::date) AS buyers,
                 (SELECT COUNT(*)::int FROM providers p WHERE p.created_at::date = d::date) AS sellers
          FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d
          ORDER BY d`,
      sql`SELECT d::date AS day,
                 (SELECT COUNT(*)::int FROM inquiries i WHERE i.created_at::date = d::date) AS count
          FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d
          ORDER BY d`,
      sql`SELECT country, COUNT(*)::int AS count FROM (
            SELECT country FROM buyers WHERE country IS NOT NULL AND country <> ''
            UNION ALL
            SELECT country FROM providers WHERE country IS NOT NULL AND country <> ''
          ) c GROUP BY country ORDER BY count DESC LIMIT 6`,
      sql`SELECT p.id, p.company_name, p.country,
                 COUNT(DISTINCT pr.id)::int AS product_count,
                 (SELECT COUNT(*)::int FROM inquiries i WHERE i.provider_id = p.id) AS inquiry_count,
                 (SELECT COUNT(*)::int FROM inquiries i WHERE i.provider_id = p.id AND i.status = 'accepted') AS accepted_count
          FROM providers p
          LEFT JOIN products pr ON pr.provider_id = p.id
          WHERE p.status = 'approved'
          GROUP BY p.id
          ORDER BY inquiry_count DESC, product_count DESC
          LIMIT 5`,
      sql`SELECT COALESCE(NULLIF(category, ''), 'Uncategorised') AS category, COUNT(*)::int AS count
          FROM products GROUP BY 1 ORDER BY count DESC LIMIT 6`,
      sql`SELECT * FROM (
            SELECT 'buyer_registered' AS type, u.username AS actor, NULL AS detail, b.status, b.created_at AS at
              FROM buyers b JOIN users u ON u.id = b.user_id
            UNION ALL
            SELECT 'seller_registered', p.company_name, u.username, p.status, p.created_at
              FROM providers p JOIN users u ON u.id = p.user_id
            UNION ALL
            SELECT 'inquiry', ub.username, COALESCE(pr.product_name, 'Product'), i.status, i.created_at
              FROM inquiries i
              LEFT JOIN buyers b ON b.id = i.buyer_id
              LEFT JOIN users ub ON ub.id = b.user_id
              LEFT JOIN products pr ON pr.id = i.product_id
          ) a ORDER BY at DESC LIMIT 12`,
    ]);

    const byStatus = (rows) => rows.reduce((acc, r) => ({ ...acc, [r.status || 'unknown']: r.count }), {});
    const sellers = byStatus(sellerStatus);
    const buyers = byStatus(buyerStatus);
    const inquiries = byStatus(inquiryStatus);
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    const totalInquiries = sum(inquiries);
    const respondedInquiries = (inquiries.accepted || 0) + (inquiries.rejected || 0);

    res.json({
      sellers: { ...sellers, total: sum(sellers) },
      buyers: { ...buyers, total: sum(buyers) },
      inquiries: { ...inquiries, total: totalInquiries },
      responseRate: totalInquiries ? respondedInquiries / totalInquiries : null,
      acceptanceRate: respondedInquiries ? (inquiries.accepted || 0) / respondedInquiries : null,
      catalog: { products: catalog[0].products, units: Number(catalog[0].units), inventoryValue: catalog[0].inventory_value },
      onlineUsers: sessions[0].online,
      inquiries30d: inquiryWindows[0],
      signups30d: signupWindows[0],
      signupTrend,
      inquiryTrend,
      topCountries,
      topSellers,
      topCategories,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching management overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.get('/overview', ...guard, overviewHandler);

// ─── Account review (approve / reject / revoke / reinstate) ─────────────────────
// Rejecting an already-approved account revokes access: active sessions are ended.
// The account holder is emailed about every decision.
const reviewAccount = (table, status) => async (req, res) => {
  try {
    const id = req.params.id;
    const rows = table === 'providers'
      ? await sql`UPDATE providers SET status = ${status}, reviewed_at = NOW() WHERE id = ${id} RETURNING user_id, email`
      : await sql`UPDATE buyers SET status = ${status}, reviewed_at = NOW() WHERE id = ${id} RETURNING user_id, email`;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { user_id: userId, email } = rows[0];
    if (status === 'rejected') {
      await sql`DELETE FROM user_sessions WHERE user_id = ${userId}`;
    }

    const [user] = await sql`SELECT username, role FROM users WHERE id = ${userId}`;
    sendAccountStatusEmail({ to: email, username: user?.username, role: table === 'buyers' ? (user?.role === 'reseller' ? 'reseller' : 'buyer') : 'seller', status })
      .catch(err => console.error(`Account ${status} email failed:`, err.message));

    const label = table === 'buyers' ? 'Buyer' : 'Seller';
    res.json({ message: `${label} ${status === 'approved' ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error(`Error updating ${table} status:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.put('/sellers/:id/approve', ...guard, reviewAccount('providers', 'approved'));
router.put('/providers/:id/approve', ...guard, reviewAccount('providers', 'approved'));
router.put('/sellers/:id/reject', ...guard, reviewAccount('providers', 'rejected'));
router.put('/providers/:id/reject', ...guard, reviewAccount('providers', 'rejected'));
router.put('/buyers/:id/approve', ...guard, reviewAccount('buyers', 'approved'));
router.put('/buyers/:id/reject', ...guard, reviewAccount('buyers', 'rejected'));

export default router;
