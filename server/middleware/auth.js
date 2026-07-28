import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // If the token has a sessionId, verify it exists in the database
    if (decoded.sessionId) {
      const { sql } = await import('../db.js');
      const sessions = await sql`SELECT id FROM user_sessions WHERE session_token = ${decoded.sessionId}`;
      if (sessions.length === 0) {
        return res.status(401).json({ error: 'Session expired or logged in from another device' });
      }
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function authenticateManagement(req, res, next) {
  if (!req.user || req.user.role !== 'management') {
    return res.status(403).json({ error: 'Access denied. Management role required.' });
  }
  next();
}
