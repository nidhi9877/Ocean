import { Router } from 'express';
import { sql } from '../db.js';
import { authenticateToken, authenticateManagement, authenticateAdminOrManagement } from '../middleware/auth.js';

const router = Router();

// GET all pending sellers / providers
const getPendingSellers = async (req, res) => {
  try {
    const pendingProviders = await sql`
      SELECT p.*, u.username
      FROM providers p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
    `;
    res.json(pendingProviders);
  } catch (error) {
    console.error('Error fetching pending sellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.get('/pending-sellers', authenticateToken, authenticateAdminOrManagement, getPendingSellers);
router.get('/pending-providers', authenticateToken, authenticateAdminOrManagement, getPendingSellers);

// GET all sellers (all statuses)
router.get('/all-sellers', authenticateToken, authenticateAdminOrManagement, async (req, res) => {
  try {
    const sellers = await sql`
      SELECT p.id, p.company_name, p.contact_person, p.email, p.phone,
             p.address, p.city, p.country, p.description, p.payment_mode,
             p.status, p.created_at, u.username
      FROM providers p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;
    res.json(sellers);
  } catch (error) {
    console.error('Error fetching all sellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all buyers
router.get('/all-buyers', authenticateToken, authenticateAdminOrManagement, async (req, res) => {
  try {
    const buyers = await sql`
      SELECT b.id, b.email, b.phone, b.country, b.imo_number,
             b.ship_name, b.ship_type, b.created_at, u.username
      FROM buyers b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `;
    res.json(buyers);
  } catch (error) {
    console.error('Error fetching all buyers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET platform stats
router.get('/stats', authenticateToken, authenticateAdminOrManagement, async (req, res) => {
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

// PUT approve seller
const approveSeller = async (req, res) => {
  try {
    const providerId = req.params.id;
    await sql`UPDATE providers SET status = 'approved' WHERE id = ${providerId}`;
    res.json({ message: 'Seller approved successfully' });
  } catch (error) {
    console.error('Error approving seller:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.put('/sellers/:id/approve', authenticateToken, authenticateAdminOrManagement, approveSeller);
router.put('/providers/:id/approve', authenticateToken, authenticateAdminOrManagement, approveSeller);

// PUT reject seller
const rejectSeller = async (req, res) => {
  try {
    const providerId = req.params.id;
    await sql`UPDATE providers SET status = 'rejected' WHERE id = ${providerId}`;
    res.json({ message: 'Seller rejected successfully' });
  } catch (error) {
    console.error('Error rejecting seller:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.put('/sellers/:id/reject', authenticateToken, authenticateAdminOrManagement, rejectSeller);
router.put('/providers/:id/reject', authenticateToken, authenticateAdminOrManagement, rejectSeller);

export default router;
