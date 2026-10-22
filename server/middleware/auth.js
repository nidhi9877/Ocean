import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sql } from '../db.js';

dotenv.config();

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    // If the token has a sessionId, verify it exists in the database
    if (decoded.sessionId) {
      const sessions = await sql`SELECT id, last_active FROM user_sessions WHERE session_token = ${decoded.sessionId}`;
      if (sessions.length === 0) {
        return res.status(401).json({ error: 'Session expired or logged in from another device' });
      }

      // Keep last_active updated while user is actively making requests (throttled to every 20s)
      const lastActive = sessions[0].last_active ? new Date(sessions[0].last_active).getTime() : 0;
      if (Date.now() - lastActive > 20000) {
        await sql`UPDATE user_sessions SET last_active = NOW() WHERE session_token = ${decoded.sessionId}`;
      }
    }

    next();
  } catch (error) {
    console.error('Session verification error:', error);
    return res.status(500).json({ error: 'Authentication verification failed. Please try again.' });
  }
}

export function authenticateManagement(req, res, next) {
  if (!req.user || req.user.role !== 'management') {
    return res.status(403).json({ error: 'Access denied. Management role required.' });
  }
  next();
}

export function authenticateAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
}

// Allows either admin or management roles
export function authenticateAdminOrManagement(req, res, next) {
  if (!req.user || (req.user.role !== 'management' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Access denied. Admin or Management role required.' });
  }
  next();
}
