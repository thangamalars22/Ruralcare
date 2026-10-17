import { useEffect, useState } from 'react';
import { Download, Eye, History, Pencil, Plus, Printer, Send, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { dayInput, doctorName, fmtDate, fmtDay, fmtTime, todayStr } from '../utils.js';
import { ErrBox, Field, Modal, StatusBadge } from './ui.jsx';

const ROUTES = ['Oral', 'Topical', 'Injection (IM)', 'Injection (IV)', 'Subcutaneous', 'Inhalation', 'Sublingual', 'Eye drops', 'Ear drops', 'Nasal', 'Rectal', 'Other'];
const FREQ = ['Once a day', 'Twice a day', 'Three times a day', 'Four times a day', 'Every 8 hours', 'At bedtime', 'Only when needed'];
const DUR = ['3 days', '5 days', '7 days', '10 days', '2 weeks', '1 month'];
const blankMed = () => ({ name: '', dosage: '', route: 'Oral', frequency: '', duration: '', instructions: '' });

// Open or download the prescription PDF. Fetched with the user's token and shown from a temporary in-browser URL.
export async function openRxPdf(p, download) {
  const win = download ? null : window.open('', '_blank');
  try {
    const blob = await api.blob(`/prescriptions/${p._id}/pdf${download ? '?download=1' : ''}`);
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement('a');
      a.href = url; a.download = `prescription-${p.rxNumber || p._id}.pdf`; document.body.appendChild(a); a.click(); a.remove();
    } else if (win) win.location.href = url;
    else throw new Error('Your browser blocked the new tab. Please allow pop-ups, or use Download.');
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) { if (win) win.close(); throw e; }
}

function Meds({ meds }) {
  return (
    <div className="meds">
      {meds.map((m, i) => (
        <div className="med" key={i}>
          <div className="med-n"><b>{m.name}</b>{m.dosage && <span className="muted"> — {m.dosage}</span>}</div>
          <div className="muted small">{[m.route, m.frequency, m.duration].filter(Boolean).join(' · ')}</div>
          {m.instructions && <div className="small">“{m.instructions}”</div>}
        </div>
      ))}
    </div>
  );
}

function HistoryList({ p }) {
  const rows = [...(p.history || [])].reverse();
  const LABEL = { created: 'Draft created', edited: 'Draft edited', published: 'Published to patient', revised: 'Revised after publishing', completed: 'Marked completed' };
  return (
    <div className="hist">
      {rows.map((h, i) => (
        <div key={i} className="hist-row">
          <div><b>{LABEL[h.action] || h.action}</b> <span className="muted small">· version {h.version} · {fmtDate(h.at, { day: '2-digit', month: 'short', year: 'numeric' })} {fmtTime(h.at)}</span></div>
          {h.snapshot && (
            <details className="small"><summary className="link">Show the previous version</summary>
              {h.snapshot.diagnosis && <div style={{ marginTop: 6 }}><b>Diagnosis:</b> {h.snapshot.diagnosis}</div>}
              <Meds meds={h.snapshot.medicines || []} />
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

// One prescription. Patients get PDF actions; doctors get edit / publish / delete / history.
export function PrescriptionCard({ p, isDoc = false, showPatient = false, onEdit, onChanged }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [hist, setHist] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const draft = p.publishStatus === 'draft';
  const run = (key, fn) => async () => { setErr(''); setBusy(key); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };

  return (
    <div className={`card hover rx is-${draft ? 'draft' : p.status} t-green`}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3>💊 {p.medicines?.length > 1 ? `${p.medicines.length} medicines` : p.medicines?.[0]?.name || 'Prescription'}</h3>
          <div className="muted small">{p.rxNumber ? `${p.rxNumber} · ` : ''}{showPatient && p.patient ? `${p.patient.name}${p.patient.patientId ? ` (${p.patient.patientId})` : ''} · ` : ''}
            {draft ? 'Draft' : `Issued ${fmtDate(p.publishedAt || p.startDate, { day: '2-digit', month: 'short', year: 'numeric' })}`}{p.version > 1 ? ` · Revised (v${p.version})` : ''}</div>
        </div>
        <StatusBadge status={draft ? 'draft' : p.status} />
      </div>

      {p.diagnosis && <div><div className="field-l">Diagnosis</div><div className="field-v">{p.diagnosis}</div></div>}
      {p.notes && <div><div className="field-l">Clinical notes</div><div className="field-v">{p.notes}</div></div>}
      <Meds meds={p.medicines || []} />
      {p.followUpDate && <div className="small"><b>Follow-up:</b> {fmtDay(p.followUpDate)}</div>}
      {p.appointment && <div className="muted small">For the visit on {fmtDate(p.appointment.date, { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
      <div className="muted small">Prescribed by {p.doctor ? doctorName(p.doctor.name) : 'your doctor'}{p.endDate && !draft ? ` · valid until ${fmtDay(p.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}</div>

      {err && <div className="field-msg" role="alert">{err}</div>}
      <div className="row" style={{ gap: 8 }}>
        {!draft && <>
          <button className="btn sm" disabled={!!busy} onClick={run('view', () => openRxPdf(p, false))}><Eye size={15} /> View PDF</button>
          <button className="btn ghost sm" disabled={!!busy} onClick={run('dl', () => openRxPdf(p, true))}><Download size={15} /> Download</button>
        </>}
        {isDoc && draft && <>
          <button className="btn sm" disabled={!!busy} onClick={() => setConfirm(true)}><Send size={15} /> Review & publish</button>
          <button className="btn ghost sm" disabled={!!busy} onClick={() => onEdit(p)}><Pencil size={15} /> Edit</button>
          <button className="btn danger sm" disabled={!!busy} onClick={run('del', async () => { if (window.confirm('Delete this draft? This cannot be undone.')) { await api.del(`/prescriptions/${p._id}`); onChanged(); } })}><Trash2 size={15} /> Delete</button>
        </>}
        {isDoc && !draft && <>
          {p.status === 'active' && <button className="btn ghost sm" disabled={!!busy} onClick={() => onEdit(p)}><Pencil size={15} /> Revise</button>}
          {p.status === 'active' && <button className="btn ghost sm" disabled={!!busy} onClick={run('done', async () => { await api.patch(`/prescriptions/${p._id}/complete`); onChanged(); })}>Mark completed</button>}
        </>}
        {isDoc && p.history?.length > 0 && <button className="btn soft sm" onClick={() => setHist(!hist)}><History size={15} /> {hist ? 'Hide history' : 'History'}</button>}
      </div>
      {hist && <HistoryList p={p} />}
      {confirm && <PublishDialog p={p} onClose={() => setConfirm(false)} onDone={() => { setConfirm(false); onChanged(); }} />}
    </div>
  );
}

// The doctor's explicit approval step. Nothing reaches the patient until this is confirmed.
export function PublishDialog({ p, onClose, onDone }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try { await api.post(`/prescriptions/${p._id}/publish`, { confirm: true }); onDone(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title="Review and publish" onClose={busy ? () => {} : onClose}>
      <ErrBox msg={err} />
      <p className="muted small" style={{ marginBottom: 12 }}>Once published, {p.patient?.name || 'the patient'} can see and download this prescription.</p>
      {p.diagnosis && <p style={{ marginBottom: 6 }}><b>Diagnosis:</b> {p.diagnosis}</p>}
      <Meds meds={p.medicines || []} />
      <label className="remember" style={{ margin: '16px 0', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>I have reviewed this prescription and approve it for the patient.</span>
      </label>
      <div className="row"><button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn" style={{ flex: 1 }} disabled={!ok || busy} onClick={go}>{busy ? 'Publishing…' : 'Approve & publish'}</button></div>
    </Modal>
  );
}

// Create / edit a prescription. `patient` fixes the patient (used from a patient's page); otherwise the doctor picks one.
export function PrescriptionEditor({ patient: fixed, prescription, onClose, onSaved }) {
  const editing = !!prescription;
  const published = editing && prescription.publishStatus !== 'draft';
  const { data: patients } = useApi(fixed || editing ? null : '/users/patients');
  const [patientId, setPatientId] = useState(fixed?._id || prescription?.patient?._id || '');
  const { data: appts } = useApi(patientId ? `/appointments?patient=${patientId}` : null);
  const [f, setF] = useState({
    appointment: prescription?.appointment?._id || '', diagnosis: prescription?.diagnosis || '', notes: prescription?.notes || '',
    followUpDate: dayInput(prescription?.followUpDate),
  });
  const [meds, setMeds] = useState(prescription?.medicines?.length ? prescription.medicines.map((m) => ({ ...blankMed(), ...m })) : [blankMed()]);
  const [approve, setApprove] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { if (!editing) setF((x) => ({ ...x, appointment: '' })); }, [patientId, editing]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setMed = (i, k) => (e) => setMeds(meds.map((m, j) => (j === i ? { ...m, [k]: e.target.value } : m)));
  const body = () => ({ patient: patientId, appointment: f.appointment || undefined, diagnosis: f.diagnosis, notes: f.notes, followUpDate: f.followUpDate || undefined, medicines: meds });

  const validate = (strict) => {
    if (!patientId) return 'Please choose a patient.';
    for (let i = 0; i < meds.length; i++) {
      const m = meds[i];
      if (!m.name.trim()) return `Medicine ${i + 1}: please enter the medicine name.`;
      if (strict) for (const [k, l] of [['dosage', 'dosage'], ['route', 'route'], ['frequency', 'frequency'], ['duration', 'duration']]) if (!String(m[k] || '').trim()) return `Medicine ${i + 1} (${m.name}): please enter the ${l}${published ? '' : ' before publishing'}.`;
    }
    return '';
  };

  // mode: 'draft' (save only) | 'publish' (save, then publish) | 'revise' (published prescription)
  const save = async (mode) => {
    const v = validate(mode !== 'draft');
    if (v) return setErr(v);
    if (mode === 'publish' && !approve) return setErr('Please tick the box to approve this prescription before publishing.');
    setErr(''); setBusy(mode);
    let saved;
    try {
      saved = editing ? await api.put(`/prescriptions/${prescription._id}`, body()) : await api.post('/prescriptions', body());
    } catch (e) { setErr(e.message); setBusy(''); return; }
    if (mode === 'publish') {
      try { await api.post(`/prescriptions/${saved._id}/publish`, { confirm: true }); }
      catch (e) { setErr(`Saved as a draft, but it was not published: ${e.message}`); setBusy(''); onSaved(false); return; }
    }
    setBusy(''); onSaved(mode === 'publish');
  };

  const liveAppts = (appts || []).filter((a) => a.status !== 'cancelled');
  return (
    <Modal title={published ? 'Revise prescription' : editing ? 'Edit draft prescription' : 'New prescription'} onClose={busy ? () => {} : onClose} wide>
      <ErrBox msg={err} />
      {published && <div className="ok note">This prescription is already visible to the patient. Your changes will replace it and the earlier version is kept in the history.</div>}
      {!published && <p className="muted small" style={{ marginBottom: 14 }}>Saved as a private draft. The patient sees nothing until you review and publish it.</p>}
      <div className="form-grid">
        <Field label="Patient *">
          {fixed || editing ? <input className="input ro" readOnly value={`${fixed?.name || prescription?.patient?.name || ''}${(fixed?.patientId || prescription?.patient?.patientId) ? ` (${fixed?.patientId || prescription.patient.patientId})` : ''}`} />
            : <select className="select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient…</option>{(patients || []).map((x) => <option key={x._id} value={x._id}>{x.name} ({x.patientId})</option>)}</select>}
        </Field>
        <Field label="Appointment (optional)">
          <select className="select" value={f.appointment} onChange={set('appointment')} disabled={!patientId}>
            <option value="">Not linked to a visit</option>
            {liveAppts.map((a) => <option key={a._id} value={a._id}>{fmtDate(a.date, { day: '2-digit', month: 'short', year: 'numeric' })} {fmtTime(a.date)} — {a.reason}</option>)}</select>
        </Field>
      </div>
      <Field label="Diagnosis"><input className="input" value={f.diagnosis} onChange={set('diagnosis')} maxLength={500} /></Field>
      <Field label="Clinical notes"><textarea className="textarea" value={f.notes} onChange={set('notes')} maxLength={3000} /></Field>

      <div className="form-section">Medicines</div>
      <datalist id="rx-freq">{FREQ.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="rx-dur">{DUR.map((x) => <option key={x} value={x} />)}</datalist>
      {meds.map((m, i) => (
        <div className="med-edit" key={i}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <b className="small">Medicine {i + 1}</b>
            {meds.length > 1 && <button type="button" className="btn danger sm" onClick={() => setMeds(meds.filter((_, j) => j !== i))} aria-label={`Remove medicine ${i + 1}`}><X size={14} /> Remove</button>}
          </div>
          <div className="form-grid">
            <Field label="Medicine name *"><input className="input" value={m.name} onChange={setMed(i, 'name')} placeholder="e.g. Paracetamol 500 mg" maxLength={120} /></Field>
            <Field label="Dosage"><input className="input" value={m.dosage} onChange={setMed(i, 'dosage')} placeholder="e.g. 1 tablet" maxLength={60} /></Field>
            <Field label="Route"><select className="select" value={m.route} onChange={setMed(i, 'route')}>{ROUTES.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Frequency"><input className="input" list="rx-freq" value={m.frequency} onChange={setMed(i, 'frequency')} placeholder="e.g. Twice a day" maxLength={80} /></Field>
            <Field label="Duration"><input className="input" list="rx-dur" value={m.duration} onChange={setMed(i, 'duration')} placeholder="e.g. 5 days" maxLength={60} /></Field>
            <Field label="Instructions"><input className="input" value={m.instructions} onChange={setMed(i, 'instructions')} placeholder="e.g. After food" maxLength={300} /></Field>
          </div>
        </div>
      ))}
      <button type="button" className="btn soft sm" style={{ marginBottom: 16 }} onClick={() => setMeds([...meds, blankMed()])} disabled={meds.length >= 20}><Plus size={15} /> Add another medicine</button>

      <Field label="Follow-up date (optional)"><input className="input" type="date" min={todayStr()} value={f.followUpDate} onChange={set('followUpDate')} style={{ maxWidth: 220 }} /></Field>

      {!published && (
        <label className="remember" style={{ margin: '4px 0 16px', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
          <span>I have reviewed this prescription and approve it for the patient (needed only to publish now).</span>
        </label>
      )}
      <div className="row">
        <button type="button" className="btn ghost" onClick={onClose} disabled={!!busy}>Cancel</button>
        {published ? (
          <button type="button" className="btn" style={{ flex: 1 }} disabled={!!busy} onClick={() => save('revise')}>{busy ? 'Saving…' : 'Save revision'}</button>
        ) : <>
          <button type="button" className="btn ghost" style={{ flex: 1 }} disabled={!!busy} onClick={() => save('draft')}>{busy === 'draft' ? 'Saving…' : 'Save as draft'}</button>
          <button type="button" className="btn" style={{ flex: 1 }} disabled={!!busy} onClick={() => save('publish')}><Printer size={16} /> {busy === 'publish' ? 'Publishing…' : 'Save & publish'}</button>
        </>}
      </div>
    </Modal>
  );
}
