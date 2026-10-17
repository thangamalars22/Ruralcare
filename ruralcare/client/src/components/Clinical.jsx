import { useRef, useState } from 'react';
import { ChevronDown, Download, ExternalLink, FileText, FileImage, Paperclip, Upload, X } from 'lucide-react';
import { fmtDay } from '../utils.js';
import { StatusBadge, Field, ErrBox, Modal } from './ui.jsx';
import { api } from '../api.js';
import { doctorName, dayInput, todayStr } from '../utils.js';
import { ACCEPT, MAX_MB, checkFile, fmtSize, formTypes, typeIcon, typeLabel } from '../reports.js';

// Open or download a record's attached file. Fetched with the user's token and shown from a temporary in-browser URL.
export async function openRecordFile(r, download) {
  const win = download ? null : window.open('', '_blank');
  try {
    const blob = await api.blob(`/records/${r._id}/file${download ? '?download=1' : ''}`);
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement('a');
      a.href = url; a.download = r.file?.originalName || 'report'; document.body.appendChild(a); a.click(); a.remove();
    } else if (win) win.location.href = url;
    else throw new Error('Your browser blocked the new tab. Please allow pop-ups for RuralCare, or use Download.');
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) { if (win) win.close(); throw e; }
}

// View / download the attached report. The file is fetched with the user's token and opened from a temporary
// in-browser URL, so there is never a public link to a medical report.
export function FileActions({ r, compact = false }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const f = r.file;
  if (!f?.originalName) return null;
  const isPdf = f.mimeType === 'application/pdf';
  const run = async (mode) => { setErr(''); setBusy(mode); try { await openRecordFile(r, mode === 'download'); } catch (ex) { setErr(ex.message); } finally { setBusy(''); } };
  return (
    <div className="attach">
      <div className="a-ico">{isPdf ? <FileText size={20} /> : <FileImage size={20} />}</div>
      <div className="a-info"><b>{f.originalName}</b><span className="muted small">{isPdf ? 'PDF' : f.mimeType === 'image/png' ? 'PNG image' : 'JPG image'} · {fmtSize(f.size)}</span>
        {err && <div className="field-msg" role="alert" style={{ marginTop: 4 }}>{err}</div>}</div>
      <button type="button" className={'btn sm' + (compact ? ' ghost' : '')} disabled={!!busy} onClick={() => run('view')}>
        {busy === 'view' ? <span className="spinner" aria-hidden="true" /> : <ExternalLink size={16} />} Open Report</button>
      <button type="button" className="btn ghost sm" disabled={!!busy} onClick={() => run('download')}>
        {busy === 'download' ? <span className="spinner" aria-hidden="true" /> : <Download size={16} />} Download</button>
    </div>
  );
}

export function RecordCard({ r, manage }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const remove = async () => {
    if (!window.confirm('Delete this medical record and its attached file? The patient will no longer see it. This cannot be undone.')) return;
    try { await api.del(`/records/${r._id}`); manage.onChanged(); } catch (e) { setErr(e.message); }
  };
  const F = ({ l, v }) => (v ? <div><div className="field-l">{l}</div><div className="field-v">{v}</div></div> : null);
  const v = r.vitals || {};
  const label = typeLabel(r.reportType);
  return (
    <div className={'rec' + (open ? ' open' : '')}>
      <button className="rec-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="rec-ico" aria-hidden="true">{typeIcon(r.reportType)}</div>
        <div style={{ minWidth: 0 }}>
          <h3>{r.title}</h3>
          <div className="muted small"><span className="type-chip">{label}</span>{fmtDay(r.visitDate)}{r.doctor ? ` · ${doctorName(r.doctor.name)}` : ''}
            {r.file?.originalName && <span className="attach-mini"><Paperclip size={13} /> Report attached</span>}</div>
          {r.diagnosis && !open && <div className="small" style={{ marginTop: 4 }}><b>Diagnosis:</b> {r.diagnosis}</div>}
        </div>
        <span className="small hide-sm" style={{ marginLeft: 'auto', color: 'var(--accent-d)', fontWeight: 600, whiteSpace: 'nowrap' }}>{open ? 'Hide' : 'View Record'}</span>
        <ChevronDown className="chev" size={22} />
      </button>
      <div className="rec-body"><div>
        <div className="rec-fields">
          <F l="Report type" v={label} /><F l="Test / visit date" v={fmtDay(r.visitDate)} />
          <F l="Doctor" v={r.doctor && doctorName(r.doctor.name)} /><F l="Diagnosis" v={r.diagnosis} />
          <F l="Test results / findings" v={r.results} /><F l="Doctor's notes" v={r.notes} />
          <F l="Symptoms" v={r.symptoms} /><F l="Treatment" v={r.treatment} />
          <F l="Follow-up date" v={r.followUpDate && fmtDay(r.followUpDate)} />
          <F l="Blood sugar" v={v.bloodSugar && `${v.bloodSugar} mg/dL`} />
          <F l="Heart rate" v={v.heartRate && `${v.heartRate} BPM`} /><F l="Blood pressure" v={v.bloodPressure} /><F l="Weight" v={v.weightKg && `${v.weightKg} KG`} />
          {r.healthStatus && <div><div className="field-l">Health status</div><div style={{ marginTop: 4 }}><StatusBadge status={r.healthStatus} /></div></div>}
          <FileActions r={r} />
          {manage && <div className="attach" style={{ background: 'transparent', border: 0, padding: 0 }}>
            <button type="button" className="btn ghost sm" onClick={() => manage.onEdit(r)}>Edit record</button>
            <button type="button" className="btn danger sm" onClick={remove}>Delete record</button>
            {err && <span className="field-msg" role="alert">{err}</span>}</div>}
        </div>
      </div></div>
    </div>
  );
}

export function RecordTimeline({ records, manage }) {
  const years = [...new Set(records.map((r) => new Date(r.visitDate).getFullYear()))];
  return (
    <div>
      {years.map((y) => (
        <div key={y} style={{ marginBottom: 22 }}>
          <div className="year">{y}</div>
          <div className="timeline">
            {records.filter((r) => new Date(r.visitDate).getFullYear() === y).map((r) => <div key={r._id} className="tl-item"><RecordCard r={r} manage={manage} /></div>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Doctor forms ----
const today = todayStr; // the doctor's local date, not the UTC date

// Add a medical record / upload a medical report for one patient.
// Step 1 saves the details (POST /records), step 2 uploads the file with progress (PUT /records/:id/file).
// If the file upload fails the new record is removed again, so no half-saved record is left behind.
// `patient` fixes the patient (used on a patient's own page). Otherwise pass `patients` and the doctor picks one.
// `requireFile` makes the attachment mandatory for a new record.
export function RecordForm({ patient, patients, record, preset = '', requireFile = false, onClose, onSaved }) {
  const editing = !!record;
  const [pid, setPid] = useState(patient?._id || (record?.patient && (record.patient._id || record.patient)) || preset || '');
  const pat = patient || (patients || []).find((x) => x._id === pid) || (record?.patient && typeof record.patient === 'object' ? record.patient : null);
  const v0 = record?.vitals || {};
  const [f, setF] = useState(editing ? {
    reportType: record.reportType || 'general', title: record.title || '', visitDate: dayInput(record.visitDate), diagnosis: record.diagnosis || '', results: record.results || '', notes: record.notes || '',
    bloodSugar: v0.bloodSugar ?? '', bloodPressure: v0.bloodPressure || '', heartRate: v0.heartRate ?? '', weightKg: v0.weightKg ?? '', symptoms: record.symptoms || '', treatment: record.treatment || '',
    followUpDate: dayInput(record.followUpDate), healthStatus: record.healthStatus || '',
  } : { reportType: 'blood_test', title: '', visitDate: today(), diagnosis: '', results: '', notes: '', bloodSugar: '', bloodPressure: '', heartRate: '', weightKg: '', symptoms: '', treatment: '', followUpDate: '', healthStatus: '' });
  const [file, setFile] = useState(null);
  const [fileErr, setFileErr] = useState('');
  const [fe, setFe] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setFe((x) => ({ ...x, [k]: undefined })); };

  const pick = (list) => {
    const x = list?.[0]; if (!x) return;
    const m = checkFile(x);
    setFileErr(m); setFile(m ? null : x);
    if (input.current) input.current.value = '';
  };

  const save = async (e) => {
    e.preventDefault(); setErr('');
    const v = {};
    if (!pid) v.patient = 'Please select a patient.';
    if (!f.title.trim()) v.title = 'Please enter a report title.';
    if (!f.visitDate) v.visitDate = 'Please enter the test date.';
    else if (f.visitDate > today()) v.visitDate = 'The test date cannot be in the future.';
    if (requireFile && !editing && !file) setFileErr('Please attach the report file (PDF, JPG or PNG).');
    setFe(v);
    if (Object.keys(v).length || (requireFile && !editing && !file)) return;
    setBusy(true); setPct(0); setPhase('Saving details…');
    let rec;
    try {
      const payload = {
        patient: pid, reportType: f.reportType, title: f.title, visitDate: f.visitDate, diagnosis: f.diagnosis, results: f.results, notes: f.notes,
        symptoms: f.symptoms, treatment: f.treatment, followUpDate: f.followUpDate || undefined, healthStatus: f.healthStatus || undefined,
        vitals: { bloodSugar: f.bloodSugar, bloodPressure: f.bloodPressure, heartRate: f.heartRate, weightKg: f.weightKg },
      };
      rec = editing ? await api.patch(`/records/${record._id}`, payload) : await api.post('/records', payload);
    } catch (ex) { setErr(ex.message); setBusy(false); setPhase(''); return; }
    if (file) {
      try {
        setPhase('Uploading report…');
        await api.upload(`/records/${rec._id}/file`, file, setPct);
      } catch (ex) {
        let msg = ex.message;
        if (editing) msg += ' Your changes to the details were saved, but the new file was not uploaded.';
        else {
          try { await api.del(`/records/${rec._id}`); msg += ' Nothing was saved — please try again.'; }
          catch { msg += ' The details were saved without the file; open the record to check it.'; }
        }
        setErr(msg); setBusy(false); setPhase(''); setPct(0); return;
      }
    }
    setBusy(false); onSaved(rec, pat);
  };

  return (
    <Modal title={editing ? 'Edit Medical Record' : 'Add Medical Record'} onClose={busy ? () => {} : onClose} wide>
      <form onSubmit={save} noValidate>
        <ErrBox msg={err} />
        <div className="form-grid">
          {patient || editing ? <>
            <Field label="Patient ID"><input className="input ro" value={pat?.patientId || '—'} readOnly aria-readonly="true" /></Field>
            <Field label="Patient name"><input className="input ro" value={pat?.name || ''} readOnly aria-readonly="true" /></Field>
          </> : <>
            <Field label="Select patient *">
              <select className="select" value={pid} onChange={(e) => { setPid(e.target.value); setFe((x) => ({ ...x, patient: undefined })); }} aria-invalid={!!fe.patient}>
                <option value="">{patients ? 'Choose a patient…' : 'Loading patients…'}</option>
                {(patients || []).map((x) => <option key={x._id} value={x._id}>{x.name} ({x.patientId})</option>)}</select>
              {fe.patient && <span className="field-msg" role="alert">{fe.patient}</span>}</Field>
            <Field label="Patient ID"><input className="input ro" value={pat?.patientId || '—'} readOnly aria-readonly="true" /></Field>
          </>}
        </div>
        <div className="form-section">Report details</div>
        <Field label="Report title *"><input className="input" value={f.title} onChange={set('title')} placeholder="e.g. Fasting blood sugar test" aria-invalid={!!fe.title} maxLength={200} />
          {fe.title && <span className="field-msg" role="alert">{fe.title}</span>}</Field>
        <div className="form-grid">
          <Field label="Report type *"><select className="select" value={f.reportType} onChange={set('reportType')}>{formTypes(f.reportType).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Test date *"><input className="input" type="date" max={today()} value={f.visitDate} onChange={set('visitDate')} aria-invalid={!!fe.visitDate} />
            {fe.visitDate && <span className="field-msg" role="alert">{fe.visitDate}</span>}</Field>
        </div>
        <Field label="Diagnosis"><input className="input" value={f.diagnosis} onChange={set('diagnosis')} /></Field>
        <Field label="Test results / findings"><textarea className="textarea" value={f.results} onChange={set('results')} placeholder="e.g. Fasting glucose 96 mg/dL — within normal range." /></Field>
        <Field label="Description and clinical notes"><textarea className="textarea" value={f.notes} onChange={set('notes')} /></Field>

        <div className="form-section">Measurements (optional)</div>
        <div className="form-grid">
          <Field label="Blood sugar (mg/dL)"><input className="input" type="number" inputMode="decimal" min="10" max="1500" value={f.bloodSugar} onChange={set('bloodSugar')} /></Field>
          <Field label="Blood pressure"><input className="input" value={f.bloodPressure} onChange={set('bloodPressure')} placeholder="120/80" maxLength={20} /></Field>
          <Field label="Heart rate (BPM)"><input className="input" type="number" inputMode="numeric" min="20" max="300" value={f.heartRate} onChange={set('heartRate')} /></Field>
          <Field label="Weight (KG)"><input className="input" type="number" inputMode="decimal" step="0.1" min="0.5" max="500" value={f.weightKg} onChange={set('weightKg')} /></Field>
        </div>
        <details style={{ marginBottom: 16 }}>
          <summary className="link small" style={{ cursor: 'pointer', marginBottom: 12 }}>More details (symptoms, treatment, follow-up, health status)</summary>
          <Field label="Symptoms"><textarea className="textarea" value={f.symptoms} onChange={set('symptoms')} /></Field>
          <div className="form-grid">
            <Field label="Treatment"><input className="input" value={f.treatment} onChange={set('treatment')} /></Field>
            <Field label="Follow-up date"><input className="input" type="date" value={f.followUpDate} onChange={set('followUpDate')} /></Field>
            <Field label="Health status"><select className="select" value={f.healthStatus} onChange={set('healthStatus')}><option value="">Not assessed</option><option value="good">Good</option><option value="attention">Needs attention</option><option value="critical">Critical</option></select></Field>
          </div>
        </details>

        <div className="form-section">Report attachment{requireFile && !editing ? ' *' : ''}</div>
        {editing && record.file?.originalName && !file && <p className="muted small" style={{ marginBottom: 8 }}>Current file: <b>{record.file.originalName}</b>. Choose a new file only if you want to replace it.</p>}
        <div className="field">
          {!file ? (
            <div className={'dropzone' + (drag ? ' drag' : '')} role="button" tabIndex={0} aria-label="Choose a report file"
              onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}>
              <Upload size={26} aria-hidden="true" />
              <b>Click to choose a file, or drag it here</b>
              <span className="small">PDF, JPG or PNG · up to {MAX_MB} MB</span>
            </div>
          ) : (
            <div className="dropzone has">
              <Paperclip size={22} aria-hidden="true" />
              <div><b style={{ wordBreak: 'break-all' }}>{file.name}</b><div className="muted small">{fmtSize(file.size)}</div></div>
              <button type="button" className="icon-btn" disabled={busy} onClick={() => setFile(null)} aria-label="Remove file"><X size={18} /></button>
            </div>
          )}
          <input ref={input} type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files)} hidden />
          {fileErr && <span className="field-msg" role="alert">{fileErr}</span>}
        </div>

        {busy && (
          <div style={{ marginBottom: 16 }} role="status" aria-live="polite">
            <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 6 }}><b>{phase}</b>{phase.startsWith('Uploading') && <span>{pct}%</span>}</div>
            <div className="progress" aria-hidden="true"><i style={{ width: `${phase.startsWith('Uploading') ? pct : 8}%` }} /></div>
          </div>
        )}
        <div className="row">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn" style={{ flex: 1 }} disabled={busy} aria-busy={busy}>{busy ? <><span className="spinner" aria-hidden="true" /> Saving…</> : file ? (editing ? 'Save & Replace File' : 'Save & Upload Report') : editing ? 'Save Changes' : 'Save Record'}</button>
        </div>
      </form>
    </Modal>
  );
}
