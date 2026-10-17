// Shared constants and helpers for medical reports.
export const REPORT_TYPES = [
  ['blood_test', 'Blood Test', '🧪'], ['blood_sugar', 'Blood Sugar', '🩸'], ['blood_pressure', 'Blood Pressure', '💓'], ['xray', 'X-ray', '🩻'],
  ['imaging', 'Scan', '🖼️'], ['ecg', 'ECG', '📈'], ['laboratory', 'Lab Report', '🔬'], ['other', 'Other', '📄'],
  // older record types (still shown for existing records, no longer offered for new ones)
  ['urine_test', 'Urine test', '🧫'], ['prescription', 'Prescription', '💊'], ['general', 'General medical report', '📋'],
];
// The types a doctor can choose for a new record. When editing an older record its own type stays selectable.
export const formTypes = (current) => REPORT_TYPES.filter(([k], i) => i < 8 || k === current);
export const typeLabel = (t) => REPORT_TYPES.find(([k]) => k === t)?.[1] || 'General medical report';
export const typeIcon = (t) => REPORT_TYPES.find(([k]) => k === t)?.[2] || '📋';

export const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
export const MAX_MB = 10;
const OK_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

// Returns an error message, or '' if the file is acceptable. (The server re-validates everything.)
export function checkFile(file) {
  if (!file) return '';
  const okExt = /\.(pdf|jpe?g|png)$/i.test(file.name);
  if (!okExt || (file.type && !OK_MIME.includes(file.type))) return 'Only PDF, JPG and PNG files are accepted.';
  if (file.size === 0) return 'This file is empty. Please choose another file.';
  if (file.size > MAX_MB * 1024 * 1024) return `This file is too large (${fmtSize(file.size)}). The maximum size is ${MAX_MB} MB.`;
  return '';
}
export const fmtSize = (n = 0) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
