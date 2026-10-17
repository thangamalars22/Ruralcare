export const fmtDate = (d, o = { day: '2-digit', month: 'long', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-IN', o) : '—';
export const fmtShort = (d) => fmtDate(d, { day: '2-digit', month: 'short' });
export const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : '';
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
};
export const firstName = (name = '') => name.replace(/^Dr\.?\s+/i, '').split(' ')[0];
export const toISO = (date, time) => new Date(`${date}T${time}`).toISOString();
const p2 = (n) => String(n).padStart(2, '0');
// Dates in the person's own timezone. (toISOString() is UTC, which is the wrong day in India between 00:00 and 05:30.)
export const localDate = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const todayStr = () => localDate();
export const timeInput = (iso) => { const d = new Date(iso); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
// Date-only fields (test date, follow-up date) are stored as UTC midnight. Show and edit them in UTC so they never shift a day.
export const fmtDay = (d, o = { day: '2-digit', month: 'long', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-IN', { ...o, timeZone: 'UTC' }) : '—';
export const dayInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
export const doctorName = (n = '') => (/^dr\.?\s/i.test(n) ? n : `Dr. ${n}`);
