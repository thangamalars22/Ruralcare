const mongoose = require('mongoose');
const { Schema } = mongoose;

// Report types a doctor can choose when adding a record / uploading a report.
const REPORT_TYPES = [
  'blood_sugar', 'blood_pressure', 'xray', 'blood_test', 'urine_test', 'ecg',
  'imaging', 'laboratory', 'prescription', 'general', 'other',
];

const schema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Legacy coarse category (kept so older records and the timeline icons keep working).
    type: { type: String, enum: ['consultation', 'lab', 'other'], default: 'consultation' },
    // Specific report type chosen by the doctor.
    reportType: { type: String, enum: REPORT_TYPES, default: 'general' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    visitDate: { type: Date, required: true }, // = test / report date
    symptoms: String,
    diagnosis: String,
    results: String, // test results / findings
    treatment: String,
    notes: String, // doctor's notes
    followUpDate: Date,
    // Optional measurements entered by the doctor. Nothing is shown unless entered.
    vitals: { heartRate: Number, bloodPressure: String, weightKg: Number, bloodSugar: Number },
    healthStatus: { type: String, enum: ['good', 'attention', 'critical'] },
    // Attached report file. The file itself lives on the server's private disk storage, never in a public folder.
    // storageKey is server-internal and is never sent to the browser.
    file: {
      storageKey: { type: String, select: false },
      originalName: String,
      mimeType: String,
      size: Number,
      uploadedAt: Date,
    },
  },
  { timestamps: true }
);
schema.index({ patient: 1, visitDate: -1 });

module.exports = mongoose.model('MedicalRecord', schema);
module.exports.REPORT_TYPES = REPORT_TYPES;
