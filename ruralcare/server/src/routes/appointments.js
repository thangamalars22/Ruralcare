const router = require('express').Router();
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ah, bad, isId, str, isLinked } = require('../lib/helpers');

router.use(auth);

const SLOT_MS = 30 * 60 * 1000; // appointments are 30 minutes long
const LIVE = ['pending', 'confirmed'];
const POP = [['patient', 'name patientId age phone'], ['doctor', 'name specialization clinic']];
const populate = (q) => POP.reduce((acc, p) => acc.populate(...p), q);

// Appointments are stored as exact instants (UTC) with seconds removed. The browser converts the person's local
// date + time to an instant before sending, so every account sees the same moment in its own timezone.
function parseDate(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  d.setSeconds(0, 0);
  return d;
}
function checkWhen(d) {
  if (!d) return 'Please choose a valid date and time.';
  if (d.getTime() < Date.now() - 60 * 1000) return 'Please choose a date and time in the future.';
  if (d.getTime() > Date.now() + 366 * 24 * 3600 * 1000) return 'Please choose a date within the next year.';
  return '';
}
// Same doctor, or same patient, may not have another live appointment within 30 minutes.
async function conflict({ doctor, patient, date, ignoreId }) {
  const base = { status: { $in: LIVE }, date: { $gt: new Date(date - SLOT_MS), $lt: new Date(+date + SLOT_MS) } };
  if (ignoreId) base._id = { $ne: ignoreId };
  if (await Appointment.exists({ ...base, doctor })) return 'That time is not available. Please choose another time.';
  if (await Appointment.exists({ ...base, patient })) return 'There is already an appointment at that time.';
  return '';
}

// List my appointments. Doctors may filter with ?patient=<id>.
router.get('/', ah(async (req, res) => {
  const filter = req.user.role === 'patient' ? { patient: req.user.id } : { doctor: req.user.id };
  if (req.user.role === 'doctor' && req.query.patient) {
    if (!isId(req.query.patient)) return bad(res, 'Invalid patient.');
    filter.patient = req.query.patient;
  }
  res.json(await populate(Appointment.find(filter).sort('date')));
}));

// Create. Patients book with a doctor; doctors create one for a patient.
router.post('/', ah(async (req, res) => {
  const b = req.body || {};
  const date = parseDate(b.date);
  const whenErr = checkWhen(date);
  if (whenErr) return bad(res, whenErr);
  const reason = str(b.reason, 200) || 'General consultation';
  let doctor, patient, createdBy, status;

  if (req.user.role === 'patient') {
    if (!isId(b.doctor)) return bad(res, 'Please choose a doctor.');
    if (!(await User.exists({ _id: b.doctor, role: 'doctor' }))) return bad(res, 'That doctor could not be found.', 404);
    doctor = b.doctor; patient = req.user.id; createdBy = 'patient'; status = 'pending';
  } else {
    if (!isId(b.patient)) return bad(res, 'Please choose a patient.');
    if (!(await User.exists({ _id: b.patient, role: 'patient' }))) return bad(res, 'That patient could not be found.', 404);
    doctor = req.user.id; patient = b.patient; createdBy = 'doctor';
    // A patient who already has a relationship with this doctor gets a confirmed visit. A new patient must accept first,
    // and until they do this appointment does not give the doctor access to their records.
    status = (await isLinked(doctor, patient)) ? 'confirmed' : 'pending';
  }
  const c = await conflict({ doctor, patient, date });
  if (c) return bad(res, c, 409);

  const a = Appointment.syncActive(new Appointment({ doctor, patient, date, reason, status, createdBy,
    history: [{ at: new Date(), by: req.user.id, action: 'created', to: date }] }));
  await a.save(); // the unique partial indexes also guard against two simultaneous requests
  res.status(201).json(await populate(Appointment.findById(a._id)));
}));

// Reschedule and/or change status.
router.patch('/:id', ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Appointment not found.', 404);
  const a = await Appointment.findById(req.params.id);
  const mine = a && String(req.user.role === 'patient' ? a.patient : a.doctor) === req.user.id;
  if (!mine) return bad(res, 'Appointment not found.', 404);
  if (!LIVE.includes(a.status)) return bad(res, `This appointment is already ${a.status} and can no longer be changed.`, 409);

  const isDoc = req.user.role === 'doctor';
  const b = req.body || {};
  const awaitingPatient = a.createdBy === 'doctor' && a.status === 'pending';
  const now = new Date();

  if (b.date === undefined && b.status === undefined) return bad(res, 'Nothing to change.');

  if (b.date !== undefined) {
    const date = parseDate(b.date);
    const whenErr = checkWhen(date);
    if (whenErr) return bad(res, whenErr);
    if (+date === +a.date) return bad(res, 'That is already the appointment time.');
    const c = await conflict({ doctor: a.doctor, patient: a.patient, date, ignoreId: a._id });
    if (c) return bad(res, c, 409);
    a.history.push({ at: now, by: req.user.id, action: 'rescheduled', from: a.date, to: date });
    a.date = date;
    // A doctor's new time is final (unless they are still waiting for the patient to accept). A patient's new time needs the doctor's OK.
    a.status = isDoc ? (awaitingPatient ? 'pending' : 'confirmed') : (awaitingPatient ? 'confirmed' : 'pending');
  }

  if (b.status !== undefined) {
    const next = b.status;
    if (!['confirmed', 'cancelled', 'completed'].includes(next)) return bad(res, 'Invalid status.');
    if (next === 'confirmed' && b.date === undefined) {
      if (isDoc && awaitingPatient) return bad(res, 'Waiting for the patient to accept this appointment.', 409);
      if (!isDoc && !awaitingPatient) return bad(res, 'Only your doctor can confirm this appointment.', 403);
      a.status = 'confirmed';
      a.history.push({ at: now, by: req.user.id, action: 'confirmed' });
    } else if (next === 'completed') {
      if (!isDoc) return bad(res, 'Only your doctor can mark an appointment completed.', 403);
      if (a.status !== 'confirmed') return bad(res, 'Confirm the appointment before marking it completed.', 409);
      a.status = 'completed';
      a.history.push({ at: now, by: req.user.id, action: 'completed' });
    } else if (next === 'cancelled') {
      a.status = 'cancelled';
      a.history.push({ at: now, by: req.user.id, action: 'cancelled' });
    }
  }
  Appointment.syncActive(a);
  await a.save();
  res.json(await populate(Appointment.findById(a._id)));
}));

module.exports = router;
