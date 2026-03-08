import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Account already exists with this email' });

    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, email, name, provider, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run(id, email.toLowerCase(), name || email.split('@')[0], 'email', hash);

    const user = { id, email: email.toLowerCase(), name: name || email.split('@')[0], provider: 'email' };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const row = db.prepare('SELECT * FROM users WHERE email = ? AND provider = ?').get(email.toLowerCase(), 'email');
    if (!row) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const user = { id: row.id, email: row.email, name: row.name, avatar: row.avatar, provider: 'email' };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/google  — verify Google ID token, upsert user
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    // Verify with Google tokeninfo endpoint (no extra SDK needed)
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!resp.ok) return res.status(401).json({ error: 'Invalid Google token' });
    const info = await resp.json();

    // Check aud matches our client ID (skip if not configured yet)
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE' && info.aud !== clientId) {
      return res.status(401).json({ error: 'Token audience mismatch' });
    }

    const { sub, email, name, picture } = info;
    if (!email) return res.status(400).json({ error: 'No email in Google token' });

    let row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!row) {
      const id = uuidv4();
      db.prepare('INSERT INTO users (id, email, name, avatar, provider) VALUES (?, ?, ?, ?, ?)')
        .run(id, email.toLowerCase(), name || email.split('@')[0], picture || null, 'google');
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else if (row.provider !== 'google') {
      // Update avatar if switched to google
      db.prepare('UPDATE users SET avatar = ?, name = ? WHERE id = ?').run(picture || row.avatar, name || row.name, row.id);
    }

    const user = { id: row.id, email: row.email, name: row.name, avatar: row.avatar || picture, provider: 'google' };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

// GET /api/auth/me — verify current token
router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, email, name, avatar, provider, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

export default router;
