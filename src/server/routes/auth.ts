import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { JWT_SECRET, ADMIN_EMAILS } from '../config.js';
import { cleanString, escapeRegex } from '../utils/validation.js';

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (userId: unknown) => jwt.sign({ userId: String(userId) }, JWT_SECRET, { expiresIn: '7d' });

// Case-insensitive lookup so accounts registered with mixed-case emails can still log in
const findByEmail = (email: string) => User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') });

// Register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const name = cleanString(req.body?.name, 80);
    const email = cleanString(req.body?.email, 254).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (password.length > 128) return res.status(400).json({ message: 'Password is too long' });

    let user = await findByEmail(email);
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
    user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    res.status(201).json({ token: signToken(user._id), user: { id: user._id, name, email, role: user.role } });
  } catch (error: any) {
    if (error?.code === 11000) return res.status(400).json({ message: 'User already exists' });
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = cleanString(req.body?.email, 254);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await findByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    res.json({ token: signToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Current user (validates the stored token and returns the fresh role)
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
