const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the JWT, then re-checks the account in the database so a deleted account cannot keep using an old
// token, and the role always comes from the database rather than from the token.
exports.auth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
  try {
    const u = await User.findById(payload.id).select('role').lean();
    if (!u) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    req.user = { id: String(u._id), role: u.role };
    next();
  } catch (e) {
    next(e);
  }
};

exports.requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ message: 'You do not have access to this.' });
