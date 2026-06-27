import jwt from 'jsonwebtoken';
import { getDb } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generates a JWT token for the given user.
 * @param {Object} user - User object with at least id, email, role
 * @returns {string} JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Express middleware that authenticates requests via Bearer token.
 * Attaches the full user object (minus password_hash) to req.user.
 */
export function authenticate(req, res, next) {
  let token = null;

  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  // 2. Fallback: check query param (used by SSE/EventSource which can't set headers)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();

    const user = db.prepare(
      'SELECT id, email, name, role, phone, avatar_color, created_at FROM users WHERE id = ?'
    ).get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export default authenticate;
