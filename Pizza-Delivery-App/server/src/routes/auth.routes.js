import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import User from '../models/User.js';
import { createOpaqueToken, sha256 } from '../utils/tokens.js';
import { sendEmail } from '../utils/mailer.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

function issueJwt(user) {
  return jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
    subject: user._id.toString(), expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Name must be 2–80 characters.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8 || !/\d/.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters and contain a number.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });

    const { token, hash } = createOpaqueToken();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name, email, passwordHash, role: 'user', emailVerified: false,
      verificationTokenHash: hash, verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    const verifyUrl = `${clientUrl()}/verify-email?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Verify your Pizza House email',
      text: `Hello ${name}, verify your email using this link (valid 24 hours): ${verifyUrl}`,
      html: `<p>Hello ${name},</p><p><a href="${verifyUrl}">Verify your email</a> (valid for 24 hours).</p>`
    });
    res.status(201).json({
      message: 'Account created. Check your email to verify it.',
      ...(process.env.NODE_ENV !== 'production' ? { devVerificationUrl: verifyUrl } : {})
    });
  } catch (error) { next(error); }
});

router.get('/verify-email', async (req, res, next) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).json({ message: 'Verification token is missing.' });
    const user = await User.findOne({
      verificationTokenHash: sha256(token), verificationExpiresAt: { $gt: new Date() }
    }).select('+verificationTokenHash +verificationExpiresAt');
    if (!user) return res.status(400).json({ message: 'Verification link is invalid or expired.' });
    user.emailVerified = true;
    user.verificationTokenHash = undefined;
    user.verificationExpiresAt = undefined;
    await user.save();
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) { next(error); }
});

async function loginWithRole(req, res, expectedRole) {
  const identifier = String(req.body.identifier || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!identifier || !password) return res.status(400).json({ message: 'Enter your email and password.' });
  const user = await User.findOne({ email: identifier, role: expectedRole }).select('+passwordHash');
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });
  if (!user.emailVerified) return res.status(403).json({ message: 'Please verify your email before logging in.' });
  const token = issueJwt(user);
  return res.json({ token, user: publicUser(user) });
}

router.post('/login', async (req, res, next) => {
  try { await loginWithRole(req, res, 'user'); } catch (error) { next(error); }
});

router.post('/admin/login', async (req, res, next) => {
  try { await loginWithRole(req, res, 'admin'); } catch (error) { next(error); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const genericMessage = 'If an account exists for that email, a reset link has been sent.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    const user = await User.findOne({ email, role: 'user' }).select('+resetTokenHash +resetExpiresAt');
    if (!user) return res.json({ message: genericMessage });
    const { token, hash } = createOpaqueToken();
    user.resetTokenHash = hash;
    user.resetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const resetUrl = `${clientUrl()}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Reset your Pizza House password',
      text: `Reset your password within 30 minutes: ${resetUrl}`,
      html: `<p><a href="${resetUrl}">Reset your password</a> (valid for 30 minutes).</p>`
    });
    res.json({ message: genericMessage, ...(process.env.NODE_ENV !== 'production' ? { devResetUrl: resetUrl } : {}) });
  } catch (error) { next(error); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (password.length < 8 || !/\d/.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters and contain a number.' });
    const user = await User.findOne({
      resetTokenHash: sha256(token), resetExpiresAt: { $gt: new Date() }
    }).select('+resetTokenHash +resetExpiresAt +passwordHash');
    if (!user) return res.status(400).json({ message: 'Reset link is invalid or expired.' });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = undefined;
    user.resetExpiresAt = undefined;
    await user.save();
    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (error) { next(error); }
});

export default router;
