import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sql } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, email, phone, imo_number, ship_name, ship_type } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    // Strong password validation
    const hasText = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    if (!hasText || !hasNumber || !hasSpecial || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and contain texts, numbers, and at least one special character' });
    }

    if (!['buyer', 'provider'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "buyer" or "provider"' });
    }

    // Additional validation for buyer
    if (role === 'buyer') {
      if (!email || !phone) {
        return res.status(400).json({ error: 'All buyer details (email, phone) are required' });
      }
    }

    // Check if username already exists (with retry logic for database cold starts)
    let existingUser;
    try {
      existingUser = await sql`SELECT id FROM users WHERE username = ${username}`;
    } catch (dbError) {
      console.log('Database cold start, retrying register query...', dbError.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
      existingUser = await sql`SELECT id FROM users WHERE username = ${username}`;
    }

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
    }

    // Check if email already exists
    if (email) {
      const existingBuyerEmail = await sql`SELECT user_id FROM buyers WHERE email = ${email}`;
      const existingProviderEmail = await sql`SELECT user_id FROM providers WHERE email = ${email}`;
      
      if (existingBuyerEmail.length > 0 || existingProviderEmail.length > 0) {
        return res.status(409).json({ error: 'Email already exists. Please use a different email address.' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await sql`
      INSERT INTO users (username, password_hash, role)
      VALUES (${username}, ${passwordHash}, ${role})
      RETURNING id, username, role
    `;

    const user = result[0];

    // If buyer, insert buyer details
    if (role === 'buyer') {
      await sql`
        INSERT INTO buyers (user_id, email, phone)
        VALUES (${user.id}, ${email}, ${phone})
      `;
    }

    // If provider, insert basic provider details
    if (role === 'provider') {
      const { companyName, companyType, address, paymentMode } = req.body;
      await sql`
        INSERT INTO providers (user_id, company_name, contact_person, email, phone, address, description, payment_mode, status)
        VALUES (${user.id}, ${companyName || username}, ${username}, ${email}, ${phone}, ${address || 'Not specified'}, ${companyType || ''}, ${paymentMode || 'pre-payment/credit'}, 'pending')
      `;
      
      // For providers, do NOT log them in immediately. Return pending message.
      return res.status(201).json({
        message: 'Registration successful. Your account is pending management approval.',
        pendingApproval: true
      });
    }

    // --- Concurrent Session Limit Logic ---
    const sessionToken = crypto.randomUUID();
    
    // Check active sessions count
    const activeSessions = await sql`SELECT id FROM user_sessions WHERE user_id = ${user.id} ORDER BY created_at ASC`;
    if (activeSessions.length >= 5) {
      // If 5 or more, delete the oldest to make room for this 6th one
      const sessionsToDelete = activeSessions.slice(0, activeSessions.length - 4); // Keep exactly 4, so this new one makes 5
      for (const sess of sessionsToDelete) {
        await sql`DELETE FROM user_sessions WHERE id = ${sess.id}`;
      }
    }
    
    // Insert new session
    await sql`INSERT INTO user_sessions (user_id, session_token) VALUES (${user.id}, ${sessionToken})`;

    // Generate JWT token with session ID
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, sessionId: sessionToken },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user (with retry logic for database cold starts)
    let users;
    try {
      users = await sql`SELECT * FROM users WHERE username = ${username}`;
    } catch (dbError) {
      console.log('Database cold start, retrying login query...', dbError.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
      users = await sql`SELECT * FROM users WHERE username = ${username}`;
    }

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Compare password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check approval status for providers
    if (user.role === 'provider') {
      const providerData = await sql`SELECT status FROM providers WHERE user_id = ${user.id}`;
      if (providerData.length > 0) {
        const status = providerData[0].status;
        if (status === 'pending') {
          return res.status(403).json({ error: 'Account pending approval by management.' });
        } else if (status === 'rejected') {
          return res.status(403).json({ error: 'Account application was rejected.' });
        }
      }
    }

    // --- Concurrent Session Limit Logic ---
    const sessionToken = crypto.randomUUID();
    
    // Check active sessions count
    const activeSessions = await sql`SELECT id FROM user_sessions WHERE user_id = ${user.id} ORDER BY created_at ASC`;
    if (activeSessions.length >= 5) {
      // Delete oldest sessions to keep exactly 4 (so inserting this new one makes it 5)
      const sessionsToDelete = activeSessions.slice(0, activeSessions.length - 4);
      for (const sess of sessionsToDelete) {
        await sql`DELETE FROM user_sessions WHERE id = ${sess.id}`;
      }
    }
    
    // Insert new session
    await sql`INSERT INTO user_sessions (user_id, session_token) VALUES (${user.id}, ${sessionToken})`;

    // Generate JWT token with session ID
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, sessionId: sessionToken },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.sessionId) {
        await sql`DELETE FROM user_sessions WHERE session_token = ${decoded.sessionId}`;
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // If token is invalid/expired, still consider it a successful logout from frontend perspective
    res.json({ message: 'Logged out successfully' });
  }
});

export default router;
