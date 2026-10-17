const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ah, bad, publicUser, str } = require('../lib/helpers');
const rateLimit = require('../lib/rateLimit');

const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const cleanPhone = (p) => (typeof p === 'string' && p.trim() ? p.replace(/[\s-]/g, '') : undefined);
const cleanEmail = (e) => (typeof e === 'string' && e.trim() ? e.trim().toLowerCase() : undefined);

// Slow down password guessing: 10 failed-or-not attempts per 15 minutes per IP + account name.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  key: (req) => `${req.ip}|${String(req.body?.identifier || '').toLowerCase().slice(0, 100)}`,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, key: (req) => req.ip, message: 'Too many sign-ups from this device. Please try again later.' });

async function newPatientId() {
  for (let i = 0; i < 10; i++) {
    const id = 'RC-' + Math.floor(10000 + Math.random() * 90000);
    if (!(await User.exists({ patientId: id }))) return id;
  }
  throw new Error('Could not generate patient id');
}

router.post('/register', registerLimit, ah(async (req, res) => {
  const b = req.body || {};
  const { role, password } = b;
  const name = str(b.name, 100);
  const email = cleanEmail(b.email);
  const phone = cleanPhone(b.phone);

  if (!['patient', 'doctor'].includes(role)) return bad(res, 'Please choose Patient or Doctor.');
  if (!name) return bad(res, 'Please enter your name.');
  if (!email && !phone) return bad(res, 'Please enter an email or a phone number.');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Please enter a valid email address.');
  if (phone && !/^\+?\d{7,15}$/.test(phone)) return bad(res, 'Please enter a valid phone number.');
  if (typeof password !== 'string' || password.length < 8) return bad(res, 'Password must be at least 8 characters.');
  if (password.length > 200) return bad(res, 'That password is too long.');
  if (role === 'patient') {
    const a = Number(b.age);
    if (b.age === '' || b.age == null || !Number.isFinite(a) || a < 0 || a > 120) return bad(res, 'Please enter a valid age.');
  }
  const specialization = str(b.specialization, 100);
  if (role === 'doctor' && !specialization) return bad(res, 'Please enter your specialization.');

  const dup = await User.findOne({ $or: [email && { email }, phone && { phone }].filter(Boolean) });
  if (dup) return bad(res, 'An account with this email or phone number already exists.', 409);

  const doc = { role, name, email, phone, passwordHash: await bcrypt.hash(password, 12) };
  if (role === 'patient') Object.assign(doc, { patientId: await newPatientId(), age: Number(b.age), address: str(b.address, 300) });
  else Object.assign(doc, { specialization, clinic: str(b.clinic, 150) });
  const user = await User.create(doc); // a duplicate-key race is turned into a 409 by the global error handler
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

router.post('/login', loginLimit, ah(async (req, res) => {
  const { identifier, password, role } = req.body || {};
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
    return bad(res, 'Please enter your email or phone number and password.');
  }
  const id = identifier.trim();
  const user = await User.findOne(id.includes('@') ? { email: id.toLowerCase() } : { phone: cleanPhone(id) });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return bad(res, 'Incorrect email/phone or password.', 401);
  if (role && role !== user.role) {
    return bad(res, `This account is a ${user.role} account. Please select "${user.role === 'doctor' ? 'Doctor' : 'Patient'}" above.`, 401);
  }
  res.json({ token: sign(user), user: publicUser(user) });
}));

router.get('/me', auth, ah(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return bad(res, 'Account not found.', 404);
  res.json({ user: publicUser(user) });
}));

router.put('/me', auth, ah(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return bad(res, 'Account not found.', 404);
  const b = req.body || {};
  if (b.name !== undefined) { const n = str(b.name, 100); if (!n) return bad(res, 'Name cannot be empty.'); user.name = n; }
  if (b.phone !== undefined) {
    const phone = cleanPhone(b.phone);
    if (phone && !/^\+?\d{7,15}$/.test(phone)) return bad(res, 'Please enter a valid phone number.');
    if (phone && (await User.exists({ phone, _id: { $ne: user._id } }))) return bad(res, 'That phone number is already in use.', 409);
    user.phone = phone || undefined;
  }
  if (user.role === 'patient') {
    if (b.age !== undefined) {
      const a = Number(b.age);
      if (b.age === '' || !Number.isFinite(a) || a < 0 || a > 120) return bad(res, 'Please enter a valid age.');
      user.age = a;
    }
    if (b.address !== undefined) user.address = str(b.address, 300) || '';
  } else {
    if (b.specialization !== undefined) { const s = str(b.specialization, 100); if (!s) return bad(res, 'Please enter your specialization.'); user.specialization = s; }
    if (b.clinic !== undefined) user.clinic = str(b.clinic, 150) || '';
  }
  await user.save();
  res.json({ user: publicUser(user) });
}));

module.exports = router;
