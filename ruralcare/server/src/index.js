require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}
if (/change-me|changeme|secret$/i.test(secret) || secret.length < 16) {
  const msg = 'JWT_SECRET is weak. Use a long random value, e.g. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`.';
  if (process.env.NODE_ENV === 'production') { console.error(msg); process.exit(1); }
  console.warn('WARNING: ' + msg);
}

const app = express();
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/records', require('./routes/records'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/summary', require('./routes/summary'));

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ message: `That file is too large. The maximum size is ${process.env.MAX_REPORT_MB || 10} MB.` });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'That request could not be read.' });
  if (err.name === 'CastError') return res.status(400).json({ message: 'That request contained an invalid value.' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors || {})[0]?.message || 'Please check the details you entered.' });
  if (err.code === 11000) {
    const k = Object.keys(err.keyPattern || {});
    if (k.includes('date')) return res.status(409).json({ message: 'That time was just taken. Please choose another time.' });
    return res.status(409).json({ message: 'That already exists.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ruralcare', { serverSelectionTimeoutMS: 8000 })
  .then(() => app.listen(PORT, () => console.log(`RuralCare API running on port ${PORT}`)))
  .catch((e) => {
    console.error('Could not connect to MongoDB:', e.message);
    console.error('Is MongoDB running, and is MONGO_URI in server/.env correct?');
    process.exit(1);
  });
