import { Router } from 'express';
import { sql } from '../db.js';
import { authenticateToken, authenticateManagement } from '../middleware/auth.js';

const router = Router();

// GET all pending providers
router.get('/pending-providers', authenticateToken, authenticateManagement, async (req, res) => {
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
    console.error('Error fetching pending providers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT approve provider
router.put('/providers/:id/approve', authenticateToken, authenticateManagement, async (req, res) => {
  try {
    const providerId = req.params.id;
    await sql`UPDATE providers SET status = 'approved' WHERE id = ${providerId}`;
    res.json({ message: 'Provider approved successfully' });
  } catch (error) {
    console.error('Error approving provider:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT reject provider
router.put('/providers/:id/reject', authenticateToken, authenticateManagement, async (req, res) => {
  try {
    const providerId = req.params.id;
    await sql`UPDATE providers SET status = 'rejected' WHERE id = ${providerId}`;
    res.json({ message: 'Provider rejected successfully' });
  } catch (error) {
    console.error('Error rejecting provider:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
