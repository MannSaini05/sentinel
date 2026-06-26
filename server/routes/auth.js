import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../services/emailService.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account.
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, phone } = req.body;

    // Validation
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'email, password, name, and role are required' });
    }

    if (!['parent', 'child'].includes(role)) {
      return res.status(400).json({ error: 'role must be either "parent" or "child"' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();

    // Check for existing user
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password and create user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = uuidv4();
    const avatarColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, phone, avatar_color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, passwordHash, name, role, phone || null, avatarColor, createdAt);

    const user = {
      id,
      email,
      name,
      role,
      phone: phone || null,
      avatar_color: avatarColor,
      created_at: createdAt,
    };

    const token = generateToken(user);

    // Send welcome email (non-blocking — don't await)
    sendWelcomeEmail(email, name, role).catch(err => {
      console.error('[Auth] Welcome email failed:', err.message);
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate and return JWT + user profile.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;
    const token = generateToken(userWithoutPassword);

    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Return current authenticated user's profile.
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/link-child
 * Parent links a child account using a 6-char link code.
 */
router.post('/link-child', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can link child accounts' });
    }

    const { linkCode } = req.body;
    if (!linkCode) {
      return res.status(400).json({ error: 'linkCode is required' });
    }

    const db = getDb();

    // Find the link entry with this code that hasn't been claimed yet
    const link = db.prepare(
      'SELECT * FROM parent_child_links WHERE link_code = ? AND parent_id IS NULL'
    ).get(linkCode.toUpperCase());

    if (!link) {
      // Also check if the code exists but is already linked
      const existingLink = db.prepare(
        'SELECT * FROM parent_child_links WHERE link_code = ?'
      ).get(linkCode.toUpperCase());

      if (existingLink) {
        return res.status(409).json({ error: 'This link code has already been used' });
      }
      return res.status(404).json({ error: 'Invalid link code' });
    }

    // Check if already linked
    const existingRelation = db.prepare(
      'SELECT id FROM parent_child_links WHERE parent_id = ? AND child_id = ?'
    ).get(req.user.id, link.child_id);

    if (existingRelation) {
      return res.status(409).json({ error: 'This child is already linked to your account' });
    }

    // Update the link with the parent_id
    db.prepare(
      'UPDATE parent_child_links SET parent_id = ? WHERE id = ?'
    ).run(req.user.id, link.id);

    const child = db.prepare(
      'SELECT id, email, name, role, avatar_color FROM users WHERE id = ?'
    ).get(link.child_id);

    res.json({ message: 'Child linked successfully', child });
  } catch (err) {
    console.error('[Auth] Link child error:', err);
    res.status(500).json({ error: 'Failed to link child account' });
  }
});

/**
 * POST /api/auth/generate-link-code
 * Child generates a 6-character alphanumeric code for a parent to use.
 */
router.post('/generate-link-code', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'child') {
      return res.status(403).json({ error: 'Only child accounts can generate link codes' });
    }

    const db = getDb();
    const code = generateLinkCode();
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    // Remove any previous unused link codes for this child
    db.prepare(
      'DELETE FROM parent_child_links WHERE child_id = ? AND parent_id IS NULL'
    ).run(req.user.id);

    // Create a new link entry with the code (parent_id will be set when claimed)
    db.prepare(`
      INSERT INTO parent_child_links (id, parent_id, child_id, link_code, created_at)
      VALUES (?, NULL, ?, ?, ?)
    `).run(id, req.user.id, code, createdAt);

    res.json({ linkCode: code });
  } catch (err) {
    console.error('[Auth] Generate link code error:', err);
    res.status(500).json({ error: 'Failed to generate link code' });
  }
});

/**
 * Generates a random 6-character alphanumeric code.
 */
function generateLinkCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default router;
