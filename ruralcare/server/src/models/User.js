const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['patient', 'doctor'], required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    // patient
    patientId: { type: String, unique: true, sparse: true },
    age: { type: Number, min: 0, max: 120 },
    address: { type: String, trim: true },
    // doctor
    specialization: { type: String, trim: true },
    clinic: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
