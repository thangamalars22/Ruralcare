// Validation and helpers for prescriptions.
const crypto = require('crypto');

const ROUTES = ['Oral', 'Topical', 'Injection (IM)', 'Injection (IV)', 'Subcutaneous', 'Inhalation', 'Sublingual', 'Eye drops', 'Ear drops', 'Nasal', 'Rectal', 'Other'];
const LIMITS = { name: 120, dosage: 60, frequency: 80, duration: 60, instructions: 300 };
const MAX_MEDICINES = 20;

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// Returns { meds, error }. With strict=true (publishing) every medicine needs name, dosage, route, frequency and duration.
function cleanMedicines(input, strict) {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Please add at least one medicine.' };
  if (input.length > MAX_MEDICINES) return { error: `A prescription can have at most ${MAX_MEDICINES} medicines.` };
  const meds = [];
  for (let i = 0; i < input.length; i++) {
    const m = input[i] || {};
    const med = {
      name: clip(m.name, LIMITS.name), dosage: clip(m.dosage, LIMITS.dosage), route: clip(m.route, 30),
      frequency: clip(m.frequency, LIMITS.frequency), duration: clip(m.duration, LIMITS.duration), instructions: clip(m.instructions, LIMITS.instructions),
    };
    const n = i + 1;
    if (!med.name) return { error: `Medicine ${n}: please enter the medicine name.` };
    if (med.route && !ROUTES.includes(med.route)) return { error: `Medicine ${n}: please choose a valid route.` };
    if (strict) {
      for (const [k, label] of [['dosage', 'dosage'], ['route', 'route'], ['frequency', 'frequency'], ['duration', 'duration']]) {
        if (!med[k]) return { error: `Medicine ${n} (${med.name}): please enter the ${label} before publishing.` };
      }
    }
    meds.push(med);
  }
  return { meds };
}

// "5 days", "2 weeks", "1 month" -> number of days (null if not understood)
function durationDays(text) {
  const m = /(\d+)\s*(day|days|d|week|weeks|wk|wks|month|months)\b/i.exec(text || '');
  if (!m) return null;
  const n = Number(m[1]); const u = m[2].toLowerCase();
  return n * (u.startsWith('w') ? 7 : u.startsWith('m') ? 30 : 1);
}
// Latest end among the medicines, counted from the publish date. null if no medicine has a parseable duration.
function computeEndDate(meds, from) {
  const days = meds.map((m) => durationDays(m.duration)).filter(Boolean);
  if (!days.length) return undefined;
  return new Date(from.getTime() + Math.max(...days) * 86400000);
}

const newRxNumber = () => 'RX-' + crypto.randomBytes(4).toString('hex').toUpperCase();

// Content that gets snapshotted into history when a published prescription is revised.
const contentOf = (p) => ({
  diagnosis: p.diagnosis, notes: p.notes, followUpDate: p.followUpDate,
  medicines: (p.medicines || []).map((m) => ({ name: m.name, dosage: m.dosage, route: m.route, frequency: m.frequency, duration: m.duration, instructions: m.instructions })),
});

module.exports = { ROUTES, cleanMedicines, durationDays, computeEndDate, newRxNumber, contentOf };
