const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    reason: { type: String, trim: true, default: 'General consultation' },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
    // Who created it. Older appointments have no value and are treated as patient-booked.
    createdBy: { type: String, enum: ['patient', 'doctor'], default: 'patient' },
    // true while pending/confirmed. Backs the unique indexes below, so two live appointments can never take the
    // same minute for one doctor (or one patient), even if two requests arrive at the same moment.
    active: { type: Boolean },
    history: [{ _id: false, at: Date, by: { type: Schema.Types.ObjectId, ref: 'User' }, action: String, from: Date, to: Date }],
  },
  { timestamps: true }
);
schema.index({ doctor: 1, date: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ patient: 1, date: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.statics.syncActive = (a) => { a.active = ['pending', 'confirmed'].includes(a.status) ? true : undefined; return a; };

module.exports = mongoose.model('Appointment', schema);
