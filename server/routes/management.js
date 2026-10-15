import { Router } from 'express';
import { sql } from '../db.js';
import { authenticateToken, authenticateManagement } from '../middleware/auth.js';

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

router.get('/pending-sellers', authenticateToken, authenticateManagement, getPendingSellers);
router.get('/pending-providers', authenticateToken, authenticateManagement, getPendingSellers);

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

router.put('/sellers/:id/approve', authenticateToken, authenticateManagement, approveSeller);
router.put('/providers/:id/approve', authenticateToken, authenticateManagement, approveSeller);

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

router.put('/sellers/:id/reject', authenticateToken, authenticateManagement, rejectSeller);
router.put('/providers/:id/reject', authenticateToken, authenticateManagement, rejectSeller);

export default router;
