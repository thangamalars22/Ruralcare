const router = require('express').Router();
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { ah, bad, isId, str, isLinked } = require('../lib/helpers');
const rx = require('../lib/rx');
const { prescriptionPdf } = require('../lib/pdf');

router.use(auth);

const isPublished = (p) => p.publishStatus !== 'draft'; // records from before drafts existed count as published
const POP = [['doctor', 'name specialization clinic'], ['patient', 'name patientId age'], ['appointment', 'date reason status']];
const populate = (q) => POP.reduce((acc, p) => acc.populate(...p), q);
const DATE = (v) => { if (!v) return undefined; const d = new Date(v); return isNaN(d) ? null : d; };

// What the API returns. Patients never receive history/snapshots; legacy single-medicine records are shown as one medicine.
function present(p, role) {
  const o = p.toObject ? p.toObject() : { ...p };
  o.publishStatus = isPublished(o) ? 'published' : 'draft';
  if (!o.medicines?.length && o.medicine) o.medicines = [{ name: o.medicine, dosage: o.dosage, frequency: o.frequency, instructions: o.instructions }];
  if (o.status === 'active' && o.endDate && new Date(o.endDate).getTime() + 86400000 < Date.now()) o.status = 'expired'; // valid through the end date
  if (role !== 'doctor') delete o.history;
  else o.history = (o.history || []).map((h) => ({ at: h.at, action: h.action, version: h.version, snapshot: h.snapshot }));
  delete o.__v;
  return o;
}

// Parse + validate the editable content shared by create and update.
function readContent(b, strict) {
  const { meds, error } = rx.cleanMedicines(b.medicines, strict);
  if (error) return { error };
  const followUpDate = DATE(b.followUpDate);
  if (followUpDate === null) return { error: 'Please enter a valid follow-up date.' };
  return { content: { diagnosis: str(b.diagnosis, 500), notes: str(b.notes, 3000), medicines: meds, followUpDate } };
}
async function checkAppointment(id, doctor, patient) {
  if (!id) return '';
  if (!isId(id)) return 'Please choose a valid appointment.';
  const a = await Appointment.findOne({ _id: id, doctor, patient }).select('_id').lean();
  return a ? '' : 'That appointment does not belong to this doctor and patient.';
}

// List. Patient: only their own PUBLISHED prescriptions. Doctor: their own (drafts included), or a patient's published ones from other doctors.
router.get('/', ah(async (req, res) => {
  let filter;
  if (req.user.role === 'patient') {
    filter = { patient: req.user.id, publishStatus: { $ne: 'draft' } };
  } else if (req.query.patient) {
    if (!isId(req.query.patient)) return bad(res, 'Invalid patient.');
    if (!(await isLinked(req.user.id, req.query.patient))) return bad(res, 'You do not have access to this patient.', 403);
    filter = { patient: req.query.patient, $or: [{ doctor: req.user.id }, { publishStatus: { $ne: 'draft' } }] };
  } else {
    filter = { doctor: req.user.id };
  }
  if (req.user.role === 'doctor' && ['draft', 'published'].includes(req.query.state)) {
    if (req.query.state === 'draft') filter.publishStatus = 'draft'; else filter.publishStatus = { $ne: 'draft' };
  }
  const list = await populate(Prescription.find(filter).sort('-createdAt').limit(300));
  res.json(list.map((p) => present(p, req.user.role)));
}));

// One prescription (used by the editor)
router.get('/:id', ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Prescription not found.', 404);
  const p = await populate(Prescription.findById(req.params.id));
  const ok = p && (req.user.role === 'patient'
    ? String(p.patient._id) === req.user.id && isPublished(p)
    : String(p.doctor._id) === req.user.id || (isPublished(p) && (await isLinked(req.user.id, p.patient._id))));
  if (!ok) return bad(res, 'Prescription not found.', 404);
  res.json(present(p, req.user.role));
}));

// Create a DRAFT. Nothing is visible to the patient until the doctor publishes it.
router.post('/', requireRole('doctor'), ah(async (req, res) => {
  const b = req.body || {};
  if (!isId(b.patient)) return bad(res, 'Please choose a patient.');
  if (!(await isLinked(req.user.id, b.patient))) return bad(res, 'You do not have access to this patient.', 403);
  const { content, error } = readContent(b, false);
  if (error) return bad(res, error);
  const apptErr = await checkAppointment(b.appointment, req.user.id, b.patient);
  if (apptErr) return bad(res, apptErr);

  let doc;
  for (let i = 0; i < 5 && !doc; i++) {
    try {
      doc = await Prescription.create({
        ...content, patient: b.patient, doctor: req.user.id, appointment: b.appointment || undefined,
        rxNumber: rx.newRxNumber(), medicine: content.medicines[0].name, publishStatus: 'draft', version: 1,
        history: [{ at: new Date(), by: req.user.id, action: 'created', version: 1 }],
      });
    } catch (e) { if (!(e.code === 11000 && i < 4)) throw e; } // rxNumber clash: retry
  }
  res.status(201).json(present(await populate(Prescription.findById(doc._id)), 'doctor'));
}));

// Edit. Drafts are edited freely. A published prescription can be revised by its doctor: the previous content is kept
// in history, the version number goes up, and the patient sees the updated (revised) prescription.
router.put('/:id', requireRole('doctor'), ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Prescription not found.', 404);
  const p = await Prescription.findOne({ _id: req.params.id, doctor: req.user.id });
  if (!p) return bad(res, 'Prescription not found.', 404);
  const b = req.body || {};
  const published = isPublished(p);
  const { content, error } = readContent(b, published); // a live prescription must stay complete
  if (error) return bad(res, error);
  const apptErr = await checkAppointment(b.appointment, req.user.id, p.patient);
  if (apptErr) return bad(res, apptErr);

  if (published) {
    p.history.push({ at: new Date(), by: req.user.id, action: 'revised', version: p.version, snapshot: rx.contentOf(p) });
    p.version += 1;
    if (!p.medicines?.length && p.medicine) p.medicines = []; // legacy record: new content replaces the single medicine
    if (p.status === 'active') p.endDate = rx.computeEndDate(content.medicines, p.publishedAt || p.createdAt) || p.endDate;
  } else {
    p.history.push({ at: new Date(), by: req.user.id, action: 'edited', version: p.version });
  }
  Object.assign(p, content);
  p.medicine = content.medicines[0].name;
  p.appointment = b.appointment || undefined;
  await p.save();
  res.json(present(await populate(Prescription.findById(p._id)), 'doctor'));
}));

// Publish = the doctor's explicit approval. Requires { confirm: true } and a complete prescription.
router.post('/:id/publish', requireRole('doctor'), ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Prescription not found.', 404);
  if ((req.body || {}).confirm !== true) return bad(res, 'Please confirm that you approve this prescription.');
  const p = await Prescription.findOne({ _id: req.params.id, doctor: req.user.id });
  if (!p) return bad(res, 'Prescription not found.', 404);
  if (isPublished(p)) return bad(res, 'This prescription is already published.', 409);
  const { meds, error } = rx.cleanMedicines(p.medicines.map((m) => ({ ...m.toObject() })), true);
  if (error) return bad(res, error);
  const now = new Date();
  p.medicines = meds;
  p.publishStatus = 'published';
  p.publishedAt = now;
  p.startDate = now;
  p.status = 'active';
  p.endDate = rx.computeEndDate(meds, now);
  p.history.push({ at: now, by: req.user.id, action: 'published', version: p.version });
  await p.save();
  res.json(present(await populate(Prescription.findById(p._id)), 'doctor'));
}));

router.patch('/:id/complete', requireRole('doctor'), ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Prescription not found.', 404);
  const p = await Prescription.findOne({ _id: req.params.id, doctor: req.user.id });
  if (!p) return bad(res, 'Prescription not found.', 404);
  if (!isPublished(p)) return bad(res, 'Publish this prescription first.', 409);
  p.status = 'completed';
  p.history.push({ at: new Date(), by: req.user.id, action: 'completed', version: p.version });
  await p.save();
  res.json(present(await populate(Prescription.findById(p._id)), 'doctor'));
}));

// Only drafts can be deleted. A published prescription is a medical record and stays (it can be revised or completed).
router.delete('/:id', requireRole('doctor'), ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Prescription not found.', 404);
  const p = await Prescription.findOne({ _id: req.params.id, doctor: req.user.id });
  if (!p) return bad(res, 'Prescription not found.', 404);
  if (isPublished(p)) return bad(res, 'A published prescription cannot be deleted.', 409);
  await p.deleteOne();
  res.json({ ok: true });
}));

// PDF of a PUBLISHED prescription. The owning patient or the prescribing doctor only. Drafts never produce a PDF.
router.get('/:id/pdf', ah(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'Prescription not found.', 404);
  const p = await Prescription.findById(req.params.id);
  const mine = p && (req.user.role === 'patient' ? String(p.patient) === req.user.id : String(p.doctor) === req.user.id);
  if (!mine) return bad(res, 'Prescription not found.', 404);
  if (!isPublished(p)) return bad(res, req.user.role === 'patient' ? 'Prescription not found.' : 'Publish this prescription before downloading the PDF.', req.user.role === 'patient' ? 404 : 409);
  const [doctor, patient] = await Promise.all([
    User.findById(p.doctor).select('name specialization clinic').lean(),
    User.findById(p.patient).select('name patientId age').lean(),
  ]);
  const o = present(p, 'doctor');
  const buf = prescriptionPdf({ ...o, rxNumber: o.rxNumber || 'RX-' + String(p._id).slice(-8).toUpperCase() }, doctor || {}, patient || {});
  const name = `prescription-${o.rxNumber || String(p._id).slice(-8)}.pdf`;
  res.set({
    'Content-Type': 'application/pdf', 'Content-Length': buf.length,
    'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${name}"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  });
  res.send(buf);
}));

module.exports = router;
