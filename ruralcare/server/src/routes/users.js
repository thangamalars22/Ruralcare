const router = require('express').Router();
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const { auth, requireRole } = require('../middleware/auth');
const { ah, bad, isId, isLinked, linkedPatientIds, escapeRegex, str } = require('../lib/helpers');

router.use(auth);

// Doctors list (used by patients to book appointments / start chats)
router.get('/doctors', ah(async (_req, res) => {
  const doctors = await User.find({ role: 'doctor' }).select('name specialization clinic').sort('name');
  res.json(doctors);
}));

// Doctor: patients who have booked with this doctor. Optional ?q= filter by name, phone or patient ID.
router.get('/patients', requireRole('doctor'), ah(async (req, res) => {
  const ids = await linkedPatientIds(req.user.id);
  const filter = { _id: { $in: ids }, role: 'patient' };
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { patientId: rx }];
  }
  const patients = await User.find(filter).select('name patientId age phone email').limit(50).sort('name').lean();
  const pids = patients.map((p) => p._id);
  const [lastRecords, appts] = await Promise.all([
    MedicalRecord.aggregate([
      { $match: { patient: { $in: pids } } },
      { $group: { _id: '$patient', last: { $max: '$visitDate' } } },
    ]),
    Appointment.find({ patient: { $in: pids }, doctor: req.user.id, date: { $gte: new Date() }, status: { $in: ['pending', 'confirmed'] } })
      .sort('date').lean(),
  ]);
  const lastMap = Object.fromEntries(lastRecords.map((r) => [String(r._id), r.last]));
  const nextMap = {};
  appts.forEach((a) => { if (!nextMap[String(a.patient)]) nextMap[String(a.patient)] = a; });
  res.json(patients.map((p) => ({
    ...p,
    lastVisit: lastMap[String(p._id)] || null,
    nextAppointment: nextMap[String(p._id)] ? { date: nextMap[String(p._id)].date, status: nextMap[String(p._id)].status } : null,
  })));
}));

// Doctor: find a patient by their RuralCare patient ID (e.g. RC-12345) to create an appointment for them.
// Returns only the minimum needed. It does NOT give access to the patient's records.
router.get('/patients/lookup', requireRole('doctor'), ah(async (req, res) => {
  const code = (str(req.query.patientId, 20) || '').toUpperCase();
  if (!/^RC-\d{5}$/.test(code)) return bad(res, 'Please enter a patient ID like RC-12345.');
  const p = await User.findOne({ role: 'patient', patientId: code }).select('name patientId age').lean();
  if (!p) return bad(res, 'No patient found with that ID.', 404);
  res.json(p);
}));

router.get('/patients/:id', requireRole('doctor'), ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Patient not found.', 404);
  if (!(await isLinked(req.user.id, req.params.id))) return bad(res, 'You do not have access to this patient.', 403);
  const p = await User.findById(req.params.id).select('name patientId age address phone email');
  if (!p) return bad(res, 'Patient not found.', 404);
  res.json(p);
}));

module.exports = router;
