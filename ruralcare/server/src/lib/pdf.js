// Minimal dependency-free PDF writer + the prescription layout.
// Uses the built-in Helvetica fonts (WinAnsi). Latin text only: characters outside Latin-1 (e.g. Tamil or Hindi
// script) cannot be drawn with these fonts and are printed as "?". Swap in a PDF library with an embedded Unicode
// font if you need those scripts on printed prescriptions.

const A4 = { w: 595.28, h: 841.89 };
const M = 48;
const CORAL = [0.863, 0.298, 0.298], DARK = [0.16, 0.145, 0.141], MUTED = [0.47, 0.443, 0.424], LINE = [0.906, 0.867, 0.835], WHITE = [1, 1, 1];

// Helvetica advance widths (1/1000 em) for ASCII 32..126
const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const width = (s, size, bold) => { let w = 0; for (const ch of s) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? HW[c - 32] : 556; } return (w * size / 1000) * (bold ? 1.07 : 1); };

const REPL = { '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2022': '*', '\u2026': '...', '\u20b9': 'Rs.', '\u00a0': ' ', '\t': ' ' };
function clean(s) {
  return String(s ?? '').replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2022\u2026\u20b9\u00a0\t]/g, (c) => REPL[c])
    .replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}
const esc = (s) => { let o = ''; for (const ch of s) { const c = ch.charCodeAt(0); o += ch === '(' || ch === ')' || ch === '\\' ? '\\' + ch : c > 126 ? '\\' + c.toString(8).padStart(3, '0') : ch; } return o; };
const n = (x) => (Math.round(x * 100) / 100).toString();
const col = (c) => `${n(c[0])} ${n(c[1])} ${n(c[2])}`;

class Doc {
  constructor(onNewPage) { this.pages = []; this.onNewPage = onNewPage; this.newPage(); }
  newPage() { this.cur = []; this.pages.push(this.cur); this.y = A4.h - M; if (this.onNewPage && this.pages.length > 1) this.onNewPage(this); }
  ensure(h) { if (this.y - h < M + 24) this.newPage(); }
  rect(x, y, w, h, c) { this.cur.push(`${col(c)} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`); }
  hline(y, c = LINE, x1 = M, x2 = A4.w - M) { this.cur.push(`${col(c)} RG 0.7 w ${n(x1)} ${n(y)} m ${n(x2)} ${n(y)} l S`); }
  text(s, x, y, { size = 10, bold = false, color = DARK } = {}) {
    this.cur.push(`BT /${bold ? 'F2' : 'F1'} ${n(size)} Tf ${col(color)} rg ${n(x)} ${n(y)} Td (${esc(clean(s))}) Tj ET`);
  }
  wrap(s, maxW, size, bold) {
    const words = clean(s).split(' ').filter(Boolean); const lines = []; let line = '';
    for (let w of words) {
      while (width(w, size, bold) > maxW) { // very long word: split it
        let k = w.length; while (k > 1 && width(w.slice(0, k), size, bold) > maxW) k--;
        if (line) { lines.push(line); line = ''; }
        lines.push(w.slice(0, k)); w = w.slice(k);
      }
      const t = line ? line + ' ' + w : w;
      if (line && width(t, size, bold) > maxW) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }
  // paragraph that flows across pages; returns nothing, advances this.y
  para(s, { x = M, w = A4.w - 2 * M, size = 10, bold = false, color = DARK, gap = 3 } = {}) {
    const lead = size * 1.4;
    for (const l of this.wrap(s, w, size, bold)) { this.ensure(lead); this.y -= lead; this.text(l, x, this.y, { size, bold, color }); }
    this.y -= gap;
  }
  build() {
    const total = this.pages.length;
    const objs = [];
    const add = (b) => { objs.push(Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1')); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    const kids = this.pages.map((_, i) => `${5 + 2 * i} 0 R`).join(' ');
    add(`<< /Type /Pages /Kids [${kids}] /Count ${total} >>`);
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.pages.forEach((ops, i) => {
      if (this.footer) { const keep = this.cur; this.cur = ops; this.footer(this, i + 1, total); this.cur = keep; }
      const stream = Buffer.from(ops.join('\n'), 'latin1');
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(A4.w)} ${n(A4.h)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`);
      add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream', 'latin1')]));
    });
    const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
    const offsets = []; let pos = parts[0].length;
    objs.forEach((o, i) => {
      offsets.push(pos);
      const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), o, Buffer.from('\nendobj\n', 'latin1')]);
      parts.push(b); pos += b.length;
    });
    let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { xref += `${String(o).padStart(10, '0')} 00000 n \n`; });
    xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
    parts.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(parts);
  }
}

const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const fmtStamp = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

// rx: plain prescription object (published), doctor / patient: { name, specialization, clinic } / { name, patientId, age }
function prescriptionPdf(rx, doctor, patient) {
  const W = A4.w - 2 * M;
  const doc = new Doc((d) => { // continuation pages get a slim header
    d.rect(0, A4.h - 30, A4.w, 30, CORAL);
    d.text('RuralCare', M, A4.h - 20, { size: 11, bold: true, color: WHITE });
    d.text(`Prescription ${rx.rxNumber || ''} (continued)`, A4.w - M - 190, A4.h - 20, { size: 9, color: WHITE });
    d.y = A4.h - 52;
  });
  doc.footer = (d, i, total) => {
    d.hline(M - 8, LINE);
    d.text(`RuralCare - Prescription ${rx.rxNumber || ''}`, M, M - 22, { size: 8, color: MUTED });
    d.text(`Page ${i} of ${total}`, A4.w - M - 44, M - 22, { size: 8, color: MUTED });
  };

  // header band
  doc.rect(0, A4.h - 78, A4.w, 78, CORAL);
  doc.text('RuralCare', M, A4.h - 38, { size: 22, bold: true, color: WHITE });
  doc.text('Centralized Medical Records Platform', M, A4.h - 55, { size: 9, color: WHITE });
  doc.text('PRESCRIPTION', A4.w - M - 110, A4.h - 36, { size: 14, bold: true, color: WHITE });
  doc.text(`No. ${rx.rxNumber || '-'}`, A4.w - M - 110, A4.h - 52, { size: 9, color: WHITE });
  doc.y = A4.h - 78 - 18;

  // doctor | patient
  const colW = W / 2 - 8, top = doc.y;
  doc.text('PRESCRIBED BY', M, top - 8, { size: 8, bold: true, color: CORAL });
  doc.text('PATIENT', M + colW + 16, top - 8, { size: 8, bold: true, color: CORAL });
  let yl = top - 24;
  const left = [[`Dr. ${String(doctor.name || '').replace(/^Dr\.?\s+/i, '')}`, true], [doctor.specialization, false], [doctor.clinic, false]].filter(([t]) => t);
  left.forEach(([t, b], i) => { doc.text(t, M, yl, { size: i === 0 ? 11.5 : 9.5, bold: b, color: i === 0 ? DARK : MUTED }); yl -= 14; });
  let yr = top - 24;
  const right = [[patient.name, true], [patient.patientId ? `Patient ID: ${patient.patientId}` : '', false], [patient.age != null ? `Age: ${patient.age}` : '', false], [`Date issued: ${fmtStamp(rx.publishedAt || rx.createdAt || new Date())}`, false]].filter(([t]) => t);
  right.forEach(([t, b], i) => { doc.text(t, M + colW + 16, yr, { size: i === 0 ? 11.5 : 9.5, bold: b, color: i === 0 ? DARK : MUTED }); yr -= 14; });
  doc.y = Math.min(yl, yr) - 6;
  doc.hline(doc.y);
  doc.y -= 6;

  const section = (title) => { doc.ensure(44); doc.y -= 18; doc.text(title.toUpperCase(), M, doc.y, { size: 8.5, bold: true, color: CORAL }); doc.y -= 2; };
  if (rx.diagnosis) { section('Diagnosis'); doc.para(rx.diagnosis, { size: 10.5 }); }
  if (rx.notes) { section('Clinical notes'); doc.para(rx.notes, { size: 10 }); }

  section('Medicines');
  (rx.medicines || []).forEach((m, i) => {
    doc.ensure(64);
    doc.y -= 6;
    doc.rect(M, doc.y - 3, 3, 3, CORAL);
    const title = `${i + 1}. ${m.name}${m.dosage ? ' - ' + m.dosage : ''}`;
    doc.para(title, { size: 11, bold: true, gap: 1 });
    const meta = [m.route && `Route: ${m.route}`, m.frequency && `Frequency: ${m.frequency}`, m.duration && `Duration: ${m.duration}`].filter(Boolean).join('   |   ');
    if (meta) doc.para(meta, { size: 9.5, color: MUTED, x: M + 14, w: W - 14, gap: 1 });
    if (m.instructions) doc.para(`Instructions: ${m.instructions}`, { size: 9.5, x: M + 14, w: W - 14, gap: 2 });
    doc.y -= 2; doc.hline(doc.y);
  });

  if (rx.followUpDate) { section('Follow-up'); doc.para(`Please review on ${fmtDay(rx.followUpDate)}.`, { size: 10.5 }); }

  doc.ensure(110);
  doc.y -= 30;
  doc.hline(doc.y, DARK, A4.w - M - 190, A4.w - M);
  doc.y -= 12;
  doc.text(`Dr. ${String(doctor.name || '').replace(/^Dr\.?\s+/i, '')}`, A4.w - M - 190, doc.y, { size: 10, bold: true });
  doc.y -= 12;
  doc.text(`Issued digitally on ${fmtStamp(rx.publishedAt || new Date())}`, A4.w - M - 190, doc.y, { size: 8, color: MUTED });
  doc.y -= 26;
  const note = `This prescription was approved and issued by the prescribing doctor through RuralCare${rx.version > 1 ? ` (revision ${rx.version})` : ''}. Take medicines only as directed. If symptoms worsen, contact your doctor or the nearest health centre.`;
  doc.para(note, { size: 8, color: MUTED });
  return doc.build();
}

module.exports = { prescriptionPdf, Doc };
