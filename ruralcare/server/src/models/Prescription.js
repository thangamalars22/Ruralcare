const mongoose = require('mongoose');
const { Schema } = mongoose;

const medicine = new Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true },
    route: { type: String, trim: true },
    frequency: { type: String, trim: true },
    duration: { type: String, trim: true },
    instructions: { type: String, trim: true },
  },
  { _id: false }
);

const schema = new Schema(
  {
    rxNumber: { type: String, unique: true, sparse: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },

    // Content (v2). Several medicines per prescription.
    diagnosis: { type: String, trim: true },
    notes: { type: String, trim: true }, // clinical notes
    medicines: [medicine],
    followUpDate: Date,

    // Workflow. Records created before this feature have NO publishStatus and are treated as published,
    // so existing prescriptions stay visible to patients. New prescriptions are always created as 'draft'.
    publishStatus: { type: String, enum: ['draft', 'published'] },
    publishedAt: Date,
    version: { type: Number, default: 1 },
    history: [{
      _id: false, at: Date, by: { type: Schema.Types.ObjectId, ref: 'User' },
      action: { type: String, enum: ['created', 'edited', 'published', 'revised', 'completed'] },
      version: Number,
      snapshot: Schema.Types.Mixed, // content before a revision of a published prescription
    }],

    // Legacy single-medicine fields (kept so old records still display).
    medicine: { type: String, trim: true },
    dosage: { type: String, trim: true },
    frequency: { type: String, trim: true },
    timing: { morning: Boolean, afternoon: Boolean, night: Boolean },
    instructions: String,

    startDate: { type: Date, default: Date.now },
    endDate: Date,
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
  },
  { timestamps: true }
);
schema.index({ patient: 1, publishStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', schema);
