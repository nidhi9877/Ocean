import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import providerRoutes from './routes/provider.js';
import adminRoutes from './routes/admin.js';
import buyerRoutes from './routes/buyer.js';
import { initCronJobs } from './cron.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/buyer', buyerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Marine Marketplace API is running' });
});

// Dummy route for accepting inquiries via email CTA
app.get('/api/deal/accept', async (req, res) => {
  try {
    const { dealId } = req.query;
    if (!dealId) return res.status(400).send('Deal ID is required');

    const { sql } = await import('./db.js');
    
    // 1. Check the inquiry
    const inquiries = await sql`SELECT status, broadcast_id FROM inquiries WHERE id = ${dealId}`;
    if (inquiries.length === 0) return res.status(404).send('Deal not found');
    
    const { status, broadcast_id } = inquiries[0];

    // If this specific deal is already accepted by this vendor, just show success
    if (status === 'accepted') {
       // Proceed to success HTML below
    } else if (broadcast_id) {
      // 2. Check if another vendor already won the broadcast
      const alreadyAccepted = await sql`
        SELECT id FROM inquiries 
        WHERE broadcast_id = ${broadcast_id} AND status = 'accepted'
      `;
      
      if (alreadyAccepted.length > 0) {
        return res.send(`
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 50px; text-align: center; background: #0f172a; height: 100vh; color: white;">
            <div style="background: #1e293b; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(239,68,68,0.5);">
              <h1 style="color: #ef4444; margin-top: 0;">❌ Too Slow!</h1>
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.5;">Another vendor has already secured this contract.</p>
              <p style="color: #94a3b8; font-size: 14px; margin-bottom: 30px;">In Vortex, the first vendor to accept the target price wins the deal. Keep an eye out for the next broadcast.</p>
              <a href="http://localhost:5174/provider/dashboard" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Go to Provider Dashboard</a>
            </div>
          </div>
        `);
      }
    }

    // 3. Mark this vendor as the winner
    await sql`UPDATE inquiries SET status = 'accepted' WHERE id = ${dealId}`;

    // 4. Mark all other competing inquiries in this broadcast as missed
    if (broadcast_id) {
      await sql`
        UPDATE inquiries 
        SET status = 'missed' 
        WHERE broadcast_id = ${broadcast_id} AND id != ${dealId} AND status = 'pending'
      `;
    }

    res.send(`
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 50px; text-align: center; background: #0f172a; height: 100vh; color: white;">
        <div style="background: #1e293b; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(34,197,94,0.3);">
          <h1 style="color: #22c55e; margin-top: 0;">✅ Deal Secured!</h1>
          <p style="color: #cbd5e1; font-size: 16px; line-height: 1.5;">You were the first to accept. The contract is yours.</p>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 30px;">The buyer has been notified. You can reply directly to the email to contact the buyer.</p>
          <a href="http://localhost:5174/provider/dashboard" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Go to Provider Dashboard</a>
        </div>
      </div>
    `);
  } catch (error) {
    console.error('Error accepting deal:', error);
    res.status(500).send('<div style="color:red;text-align:center;padding:50px;">Internal Server Error while accepting deal.</div>');
  }
});

// Serve React client build in production
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// Catch-all: serve React app for any non-API route (supports React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    initCronJobs();
    app.listen(PORT, () => {
      console.log(`🚢 Marine Marketplace API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
