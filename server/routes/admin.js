import { Router } from 'express';
import { sql } from '../db.js';

const router = Router();

// Get all users (excluding passwords of course)
router.get('/users', async (req, res) => {
  try {
    const users = await sql`
      SELECT id, username, role, created_at 
      FROM users 
      ORDER BY created_at DESC
    `;
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all providers
router.get('/providers', async (req, res) => {
  try {
    const providers = await sql`
      SELECT p.*, u.username 
      FROM providers p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;
    res.json(providers);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// Get all buyers
router.get('/buyers', async (req, res) => {
  try {
    const buyers = await sql`
      SELECT b.*, u.username 
      FROM buyers b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `;
    res.json(buyers);
  } catch (error) {
    console.error('Error fetching buyers:', error);
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
});

// Get basic platform statistics
router.get('/stats', async (req, res) => {
  try {
    const usersCount = await sql`SELECT COUNT(*) FROM users`;
    const providersCount = await sql`SELECT COUNT(*) FROM providers`;
    const productsCount = await sql`SELECT COUNT(*) FROM products`;
    
    res.json({
      totalUsers: parseInt(usersCount[0].count),
      totalProviders: parseInt(providersCount[0].count),
      totalProducts: parseInt(productsCount[0].count),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
