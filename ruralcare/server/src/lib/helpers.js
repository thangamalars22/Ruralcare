const Appointment = require('../models/Appointment');

// async route wrapper for Express 4
exports.ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.bad = (res, message, status = 400) => res.status(status).json({ message });

exports.OID = /^[a-f0-9]{24}$/i;
exports.isId = (v) => typeof v === 'string' && exports.OID.test(v);
// trimmed string with a max length, or undefined if empty / not a string
exports.str = (v, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) || undefined : undefined);

// A doctor may access a patient only if there is a real relationship between them:
//  - the patient booked an appointment with the doctor (any status), or
//  - the doctor proposed one and the patient accepted it (confirmed/completed).
// A doctor-created appointment that the patient has not accepted does NOT grant access to the patient's records.
exports.linkFilter = (doctorId, patientId) => ({
  doctor: doctorId,
  ...(patientId ? { patient: patientId } : {}),
  $or: [{ createdBy: { $ne: 'doctor' } }, { status: { $in: ['confirmed', 'completed'] } }],
});
exports.isLinked = async (doctorId, patientId) => !!(await Appointment.exists(exports.linkFilter(doctorId, patientId)));
exports.linkedPatientIds = (doctorId) => Appointment.distinct('patient', exports.linkFilter(doctorId));

exports.escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.publicUser = (u) => {
  const o = u.toObject ? u.toObject() : { ...u };
  delete o.passwordHash;
  delete o.__v;
  return o;
};
