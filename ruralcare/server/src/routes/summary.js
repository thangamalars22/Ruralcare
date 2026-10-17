const router = require('express').Router();
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const Prescription = require('../models/Prescription');
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');
const { ah, linkedPatientIds } = require('../lib/helpers');

router.use(auth);

// GET /api/summary?from=<ISO>&to=<ISO>   (from/to = the client's "today" range, used for doctors)
router.get('/', ah(async (req, res) => {
  const now = new Date();
  const unread = await Message.countDocuments({ to: req.user.id, readAt: { $exists: false } });

  if (req.user.role === 'patient') {
    const me = req.user.id;
    const [next, rxActive, records, recent] = await Promise.all([
      Appointment.findOne({ patient: me, date: { $gte: now }, status: { $in: ['pending', 'confirmed'] } })
        .sort('date').populate('doctor', 'name specialization clinic'),
      Prescription.countDocuments({ patient: me, publishStatus: { $ne: 'draft' }, status: 'active', $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] }),
      MedicalRecord.countDocuments({ patient: me }),
      MedicalRecord.find({ patient: me }).sort('-visitDate').limit(30).lean(),
    ]);
    const withVitals = recent.find((r) => r.vitals && (r.vitals.heartRate || r.vitals.bloodPressure || r.vitals.weightKg || r.vitals.bloodSugar));
    const withStatus = recent.find((r) => r.healthStatus);
    return res.json({
      nextAppointment: next,
      activePrescriptions: rxActive,
      records,
      lastCheckup: recent[0]?.visitDate || null,
      vitals: withVitals ? { ...withVitals.vitals, recordedOn: withVitals.visitDate } : null,
      healthStatus: withStatus ? withStatus.healthStatus : null,
      unread,
    });
  }

  const me = req.user.id;
  let from = req.query.from ? new Date(req.query.from) : new Date(new Date().setHours(0, 0, 0, 0));
  let to = req.query.to ? new Date(req.query.to) : new Date(new Date().setHours(23, 59, 59, 999));
  if (isNaN(from) || isNaN(to)) { from = new Date(new Date().setHours(0, 0, 0, 0)); to = new Date(new Date().setHours(23, 59, 59, 999)); }
  const [today, pending, patients, pendingList] = await Promise.all([
    Appointment.find({ doctor: me, date: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } })
      .sort('date').populate('patient', 'name patientId age'),
    Appointment.countDocuments({ doctor: me, status: 'pending', createdBy: { $ne: 'doctor' }, date: { $gte: now } }),
    linkedPatientIds(me),
    Appointment.find({ doctor: me, status: 'pending', createdBy: { $ne: 'doctor' }, date: { $gte: now } }).sort('date').limit(5).populate('patient', 'name patientId age'),
  ]);
  res.json({ today, todayCount: today.length, pending, pendingList, totalPatients: patients.length, unread });
}));

module.exports = router;
