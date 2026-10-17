const router = require('express').Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ah, bad, isId, isLinked, linkedPatientIds } = require('../lib/helpers');

router.use(auth);

router.get('/conversations', ah(async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.user.id);
  const msgs = await Message.find({ $or: [{ from: me }, { to: me }] }).sort('-createdAt').lean();
  const map = new Map();
  for (const m of msgs) {
    const other = String(m.from) === req.user.id ? String(m.to) : String(m.from);
    if (!map.has(other)) map.set(other, { userId: other, last: m, unread: 0 });
    if (String(m.to) === req.user.id && !m.readAt) map.get(other).unread += 1;
  }
  // people linked through appointments, even without messages yet
  const linked = req.user.role === 'patient' ? await Appointment.distinct('doctor', { patient: me }) : await linkedPatientIds(me);
  linked.forEach((id) => {
    if (!map.has(String(id))) map.set(String(id), { userId: String(id), last: null, unread: 0 });
  });
  const users = await User.find({ _id: { $in: [...map.keys()] } }).select('name role specialization patientId').lean();
  const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));
  const list = [...map.values()].filter((c) => byId[c.userId]).map((c) => ({ ...c, user: byId[c.userId] }));
  list.sort((a, b) => new Date(b.last?.createdAt || 0) - new Date(a.last?.createdAt || 0));
  res.json(list);
}));

router.get('/thread/:userId', ah(async (req, res) => {
  const other = req.params.userId;
  if (!isId(other)) return bad(res, 'Conversation not found.', 404);
  const filter = { $or: [{ from: req.user.id, to: other }, { from: other, to: req.user.id }] };
  const msgs = await Message.find(filter).sort('createdAt').limit(300);
  await Message.updateMany({ from: other, to: req.user.id, readAt: { $exists: false } }, { readAt: new Date() });
  res.json(msgs);
}));

router.post('/', ah(async (req, res) => {
  const { to, text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return bad(res, 'Please type a message.');
  if (text.length > 2000) return bad(res, 'That message is too long.');
  if (!isId(to)) return bad(res, 'Please choose who to message.');
  const target = await User.findById(to).select('role');
  if (!target || target.role === req.user.role) return bad(res, 'You can only message your doctor or patient.', 403);
  if (req.user.role === 'doctor') {
    const allowed = (await isLinked(req.user.id, to)) || (await Message.exists({ from: to, to: req.user.id }));
    if (!allowed) return bad(res, 'You can only message patients who have booked with you.', 403);
  }
  const m = await Message.create({ from: req.user.id, to, text: text.trim() });
  res.status(201).json(m);
}));

module.exports = router;
