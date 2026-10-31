import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sql } from '../db.js';
import dotenv from 'dotenv';
import { validateCompanyEmail } from '../utils/emailValidator.js';
import { authenticateToken } from '../middleware/auth.js';
import { TERMS_VERSION, TERMS_CONTENT_HASH } from './legal.js';
import { sendPasswordResetEmail, sendAccountStatusEmail, sendNewRegistrationAlert, sendRegistrationOtpEmail } from '../utils/email.js';

dotenv.config();

const router = Router();

// ─── Registration email verification (OTP) ──────────────────────────────────────
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const normaliseEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const hashOtp = (email, code) => crypto.createHash('sha256').update(`${email}:${code}`).digest('hex');

async function verifyRegistrationOtp(email, otp) {
  const code = String(otp || '').trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Please enter the 6-digit verification code sent to your email.' };
  }
  const [row] = await sql`
    SELECT id, code_hash, attempts FROM email_otps
    WHERE email = ${email} AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!row) {
    return { ok: false, error: 'Verification code has expired. Please request a new code.' };
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }
  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(hashOtp(email, code), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    await sql`UPDATE email_otps SET attempts = attempts + 1 WHERE id = ${row.id}`;
    const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, error: left > 0 ? `Incorrect verification code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please request a new code.' };
  }
  await sql`DELETE FROM email_otps WHERE email = ${email}`;
  return { ok: true };
}

// Step 1 of registration: email a 6-digit code to prove the address belongs to the applicant
router.post('/register/send-otp', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const emailValidation = validateCompanyEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    // Fail early on duplicates so the applicant doesn't verify an email they can't use
    if (username) {
      const existingUser = await sql`SELECT id FROM users WHERE username = ${username}`;
      if (existingUser.length > 0) {
        return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
      }
    }
    const existingEmail = await sql`
      SELECT 1 FROM buyers WHERE LOWER(email) = ${email}
      UNION ALL
      SELECT 1 FROM providers WHERE LOWER(email) = ${email}
    `;
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Email already exists. Please use a different email address.' });
    }

    // Throttle: one code per minute, at most 5 per hour, per email address
    const [recent] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute')::int AS last_minute,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS last_hour
      FROM email_otps WHERE email = ${email}
    `;
    if (recent.last_minute > 0) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another code.' });
    }
    if (recent.last_hour >= 5) {
      return res.status(429).json({ error: 'Too many codes requested for this email. Please try again in an hour.' });
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    // Older codes for this email are invalidated; rows from the last hour are kept (expired) for throttling
    await sql`UPDATE email_otps SET expires_at = NOW() WHERE email = ${email} AND expires_at > NOW()`;
    await sql`DELETE FROM email_otps WHERE created_at < NOW() - INTERVAL '1 day'`;
    const [otpRow] = await sql`
      INSERT INTO email_otps (email, code_hash, expires_at)
      VALUES (${email}, ${hashOtp(email, code)}, NOW() + (${OTP_TTL_MINUTES} * INTERVAL '1 minute'))
      RETURNING id
    `;

    try {
      await sendRegistrationOtpEmail({ to: email, username, code, expiresInMinutes: OTP_TTL_MINUTES });
    } catch (mailError) {
      console.error('Registration OTP email failed:', mailError.message);
      // The code never reached the applicant — drop it so failed sends don't use up the hourly limit
      await sql`DELETE FROM email_otps WHERE id = ${otpRow.id}`.catch(() => {});
      return res.status(502).json({ error: 'We could not send the verification email right now. Please try again in a few minutes or contact support.' });
    }

    res.json({ message: `A verification code has been sent to ${email}.`, expiresInMinutes: OTP_TTL_MINUTES });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register a new user (step 2 — requires the emailed OTP)
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, phone, imo_number, ship_name, ship_type, country, otp, acceptedTerms, termsVersion } = req.body;
    const email = normaliseEmail(req.body.email);

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

    if (!['buyer', 'provider', 'seller', 'reseller'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "buyer", "seller" or "reseller"' });
    }
    // Resellers work like buyers but pay per enquiry from a prepaid wallet. Like everyone else they
    // need management approval to sign in; after that, enquiries stay locked until the first ₹500 recharge.
    const isReseller = role === 'reseller';

    // Terms & Conditions must be accepted, and against the wording currently published
    if (acceptedTerms !== true) {
      return res.status(400).json({ error: 'You must accept the Terms & Conditions to register.', termsError: true });
    }
    if (termsVersion !== TERMS_VERSION) {
      return res.status(409).json({ error: 'Our Terms & Conditions have been updated. Please review and accept the latest version.', termsError: true, termsVersion: TERMS_VERSION });
    }

    const isSeller = role === 'provider' || role === 'seller';

    // Additional validation for buyer and seller
    if (role === 'buyer' || isReseller || isSeller) {
      if (!email || !phone) {
        return res.status(400).json({ error: 'Email and phone are required' });
      }

      if (email) {
        const emailValidation = validateCompanyEmail(email);
        if (!emailValidation.isValid) {
          return res.status(400).json({ error: emailValidation.error });
        }
      }
    }

    // Check if username already exists (with retry logic for database cold starts)
    let existingUser;
    let registerRetries = 3;
    while (registerRetries > 0) {
      try {
        existingUser = await sql`SELECT id FROM users WHERE username = ${username}`;
        break;
      } catch (dbError) {
        registerRetries--;
        console.log(`Database cold start, retrying register query... (${registerRetries} attempts left)`, dbError.message);
        if (registerRetries === 0) throw dbError;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists. Please choose a different username.' });
    }

    // Check if email already exists
    if (email) {
      const existingBuyerEmail = await sql`SELECT user_id FROM buyers WHERE LOWER(email) = ${email}`;
      const existingProviderEmail = await sql`SELECT user_id FROM providers WHERE LOWER(email) = ${email}`;
      
      if (existingBuyerEmail.length > 0 || existingProviderEmail.length > 0) {
        return res.status(409).json({ error: 'Email already exists. Please use a different email address.' });
      }
    }

    // Email ownership must be proven with the code sent by /register/send-otp
    const otpCheck = await verifyRegistrationOtp(email, otp);
    if (!otpCheck.ok) {
      return res.status(400).json({ error: otpCheck.error, otpError: true });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user (save as seller if role is seller or provider)
    const effectiveRole = isSeller ? 'seller' : role;
    const result = await sql`
      INSERT INTO users (username, password_hash, role)
      VALUES (${username}, ${passwordHash}, ${effectiveRole})
      RETURNING id, username, role
    `;

    const user = result[0];

    // If buyer or reseller, insert buyer details (resellers use the buyer profile and dashboard)
    if (role === 'buyer' || isReseller) {
      await sql`
        INSERT INTO buyers (user_id, email, phone, country, status, email_verified_at)
        VALUES (${user.id}, ${email}, ${phone}, ${country || null}, 'pending', NOW())
      `;
    }
    if (isReseller) {
      await sql`INSERT INTO wallets (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;
    }

    // If seller / provider, insert basic seller details
    if (isSeller) {
      const { companyName, companyType, address, paymentMode, country: providerCountry } = req.body;
      const finalCountry = providerCountry || country || null;
      await sql`
        INSERT INTO providers (user_id, company_name, contact_person, email, phone, address, description, payment_mode, country, status, email_verified_at)
        VALUES (${user.id}, ${companyName || username}, ${username}, ${email}, ${phone}, ${address || 'Not specified'}, ${companyType || ''}, ${paymentMode || 'pre-payment'}, ${finalCountry}, 'pending', NOW())
      `;
    }

    // Record the acceptance as evidence: who, which version, when, from where
    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
    await sql`
      INSERT INTO terms_acceptances (user_id, username, role, email, terms_version, content_hash, ip_address, user_agent)
      VALUES (${user.id}, ${user.username}, ${effectiveRole}, ${email}, ${TERMS_VERSION}, ${TERMS_CONTENT_HASH},
              ${ipAddress}, ${(req.headers['user-agent'] || '').slice(0, 500)})
    `;

    // No session is issued here: every new buyer / seller / reseller must be approved by management before signing in
    sendAccountStatusEmail({ to: email, username: user.username, role: effectiveRole, status: 'pending' })
      .catch(err => console.error('Registration acknowledgement email failed:', err.message));
    if (process.env.MANAGEMENT_NOTIFY_EMAIL) {
      sendNewRegistrationAlert({ to: process.env.MANAGEMENT_NOTIFY_EMAIL, username: user.username, role: effectiveRole, email })
        .catch(err => console.error('Management registration alert failed:', err.message));
    }

    res.status(201).json({
      message: 'Registration received. Your account is pending approval by management — you will be notified by email once it is reviewed.',
      pendingApproval: true,
      user: { id: user.id, username: user.username, role: effectiveRole }
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
    let loginRetries = 3;
    while (loginRetries > 0) {
      try {
        users = await sql`SELECT * FROM users WHERE username = ${username}`;
        break;
      } catch (dbError) {
        loginRetries--;
        console.log(`Database cold start, retrying login query... (${loginRetries} attempts left)`, dbError.message);
        if (loginRetries === 0) throw dbError;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
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

    // Check approval status for sellers / providers
    const isSeller = user.role === 'provider' || user.role === 'seller';
    if (isSeller) {
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

    // Buyers and resellers also require management approval
    if (user.role === 'buyer' || user.role === 'reseller') {
      const buyerData = await sql`SELECT status FROM buyers WHERE user_id = ${user.id}`;
      const status = buyerData[0]?.status;
      if (status === 'pending') {
        return res.status(403).json({ error: 'Account pending approval by management.' });
      } else if (status === 'rejected') {
        return res.status(403).json({ error: 'Account application was rejected.' });
      }
    }

    // --- Session Management Logic ---
    // Clean up stale or inactive sessions for this user (inactive > 2.5 minutes or older than 24 hours)
    await sql`
      DELETE FROM user_sessions 
      WHERE user_id = ${user.id} 
        AND (last_active < NOW() - INTERVAL '2 minutes 30 seconds' OR created_at < NOW() - INTERVAL '24 hours')
    `;

    // management and admin roles allow up to 5 concurrent sessions; others only 1
    const isPrivilegedRole = user.role === 'management' || user.role === 'admin';
    const sessionLimit = isPrivilegedRole ? 5 : 1;

    const activeSessions = await sql`SELECT id, last_active FROM user_sessions WHERE user_id = ${user.id}`;
    if (activeSessions.length >= sessionLimit) {
      return res.status(403).json({
        error: isPrivilegedRole
          ? `This account already has ${sessionLimit} active sessions. Please log out from one of the other sessions first.`
          : 'This account is currently logged in on another device, browser, or tab. Only one session is allowed at a time. Please log out from the other session first.'
      });
    }

    // Insert new active session
    const sessionToken = crypto.randomUUID();
    await sql`INSERT INTO user_sessions (user_id, session_token, last_active) VALUES (${user.id}, ${sessionToken}, NOW())`;

    const effectiveRole = isSeller ? 'seller' : user.role;

    // Track sign-ins: sellers are warned / frozen after a week without logging in.
    // Signing in before the freeze deadline cancels a pending inactivity warning.
    await sql`UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = ${user.id}`;
    if (isSeller) {
      await sql`UPDATE providers SET inactivity_warned_at = NULL WHERE user_id = ${user.id} AND frozen_at IS NULL`;
    }

    // Generate JWT token with session ID
    const token = jwt.sign(
      { id: user.id, username: user.username, role: effectiveRole, sessionId: sessionToken },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, role: effectiveRole }
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

// ─── Forgot / Reset Password ────────────────────────────────────────────────────
const RESET_TOKEN_TTL_MINUTES = 30;
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Request a reset link by username or registered email.
// Always responds with the same message so attackers can't discover which accounts exist.
router.post('/forgot-password', async (req, res) => {
  const genericResponse = { message: 'If an account matches the details provided, a password reset link has been sent to its registered email.' };
  try {
    const identifier = (req.body.identifier || '').trim();
    if (!identifier) {
      return res.status(400).json({ error: 'Please enter your username or email' });
    }

    // Email lives on the buyers / providers tables, not on users
    const accounts = await sql`
      SELECT u.id, u.username, COALESCE(b.email, p.email) AS email
      FROM users u
      LEFT JOIN buyers b ON b.user_id = u.id
      LEFT JOIN providers p ON p.user_id = u.id
      WHERE u.username = ${identifier}
         OR LOWER(b.email) = LOWER(${identifier})
         OR LOWER(p.email) = LOWER(${identifier})
    `;

    for (const account of accounts) {
      if (!account.email) continue;

      // Throttle: at most one reset email per account per minute
      const recent = await sql`
        SELECT id FROM password_resets
        WHERE user_id = ${account.id} AND created_at > NOW() - INTERVAL '1 minute'
      `;
      if (recent.length > 0) continue;

      // Invalidate any older unused links, then issue a new one
      await sql`DELETE FROM password_resets WHERE user_id = ${account.id} AND used_at IS NULL`;

      const token = crypto.randomBytes(32).toString('hex');
      await sql`
        INSERT INTO password_resets (user_id, token_hash, expires_at)
        VALUES (${account.id}, ${hashResetToken(token)}, NOW() + (${RESET_TOKEN_TTL_MINUTES} * INTERVAL '1 minute'))
      `;

      try {
        await sendPasswordResetEmail({
          to: account.email,
          username: account.username,
          token,
          expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
        });
      } catch (mailError) {
        console.error('Forgot password: email send failed for user', account.id, mailError.message);
      }
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set a new password using a token from the reset email
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    const hasText = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (!hasText || !hasNumber || !hasSpecial || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and contain texts, numbers, and at least one special character' });
    }

    // Atomically consume the token so it can't be used twice
    const consumed = await sql`
      UPDATE password_resets
      SET used_at = NOW()
      WHERE token_hash = ${hashResetToken(token)} AND used_at IS NULL AND expires_at > NOW()
      RETURNING user_id
    `;
    if (consumed.length === 0) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const userId = consumed[0].user_id;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
    // Sign out everywhere so a compromised session can't continue
    await sql`DELETE FROM user_sessions WHERE user_id = ${userId}`;

    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat to keep session alive while browser tab is open
router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    if (req.user && req.user.sessionId) {
      await sql`UPDATE user_sessions SET last_active = NOW() WHERE session_token = ${req.user.sessionId}`;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat update failed' });
  }
});

export default router;
