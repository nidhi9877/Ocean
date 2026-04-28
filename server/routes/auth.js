import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

    // Check if username already exists
    const existingUser = await sql`SELECT id FROM users WHERE username = ${username}`;
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
      const { companyName, companyType, address } = req.body;
      await sql`
        INSERT INTO providers (user_id, company_name, contact_person, email, phone, address, description)
        VALUES (${user.id}, ${companyName || username}, ${username}, ${email}, ${phone}, ${address || 'Not specified'}, ${companyType || ''})
      `;
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
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

    // Find user
    const users = await sql`SELECT * FROM users WHERE username = ${username}`;
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Compare password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
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

export default router;
