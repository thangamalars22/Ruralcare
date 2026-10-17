import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { api } from '../api.js';
import { fmtDate, fmtTime, toISO, todayStr, localDate, timeInput, isSameDay, doctorName } from '../utils.js';
import { Avatar, Empty, ErrorState, Modal, PageHead, SkeletonCards, Skeleton, StatusBadge, Field, ErrBox } from '../components/ui.jsx';

const LIVE = ['pending', 'confirmed'];
const short = (d) => `${fmtDate(d, { day: '2-digit', month: 'short', year: 'numeric' })} ${fmtTime(d)}`;

function ApptCard({ a, isDoc, past, onAction }) {
  const [open, setOpen] = useState(false);
  const d = new Date(a.date);
  const who = isDoc ? a.patient : a.doctor;
  const live = LIVE.includes(a.status);
  const awaitingPatient = a.createdBy === 'doctor' && a.status === 'pending';
  const last = [...(a.history || [])].reverse().find((h) => h.action === 'rescheduled');
  return (
    <div className={'card hover appt' + (past ? ' past' : '')} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
        <div className="date-tile"><b>{d.getDate()}</b><span>{d.toLocaleDateString('en-IN', { month: 'short' })}</span></div>
        <Avatar name={who?.name || '?'} size={44} />
        <div className="appt-info">
          <h3>{isDoc ? who?.name : doctorName(who?.name || '')}</h3>
          <div className="muted small">{isDoc ? (who?.patientId || 'Patient') : who?.specialization}</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>{fmtDate(a.date)} · {fmtTime(a.date)}</div>
        </div>
        <StatusBadge status={a.status} />
      </div>
      {awaitingPatient && (
        <div className="ok note" style={{ margin: 0 }}>
          {isDoc ? 'Waiting for the patient to accept this appointment.' : `${doctorName(who?.name || '')} proposed this appointment. Please accept or decline.`}
        </div>
      )}
      {open && <div className="rec-fields" style={{ margin: 0 }}>
        <div><div className="field-l">Reason</div><div className="field-v">{a.reason}</div></div>
        {!isDoc && who?.clinic && <div><div className="field-l">Clinic</div><div className="field-v">{who.clinic}</div></div>}
        {a.createdBy === 'doctor' && <div><div className="field-l">Created by</div><div className="field-v">{isDoc ? 'You' : 'Your doctor'}</div></div>}
        {last && <div><div className="field-l">Last rescheduled</div><div className="field-v">{short(last.from)} → {short(last.to)}</div></div>}
      </div>}
      <div className="row">
        <button className="btn soft sm" onClick={() => setOpen(!open)}>{open ? 'Hide Details' : 'View Details'}</button>
        {!isDoc && awaitingPatient && <button className="btn sm t-green" onClick={() => onAction('accept', a)}>Accept</button>}
        {isDoc && a.status === 'pending' && !awaitingPatient && !past && <button className="btn sm t-green" onClick={() => onAction('confirm', a)}>Confirm</button>}
        {isDoc && a.status === 'confirmed' && <button className="btn sm" onClick={() => onAction('complete', a)}>Mark Completed</button>}
        {live && !(awaitingPatient && !isDoc) && <button className="btn ghost sm" onClick={() => onAction('resched', a)}>Reschedule</button>}
        {live && <button className="btn danger sm" onClick={() => onAction('cancel', a)}>{(isDoc && a.status === 'pending' && !awaitingPatient) || (!isDoc && awaitingPatient) ? 'Decline' : 'Cancel'}</button>}
        {isDoc && a.status !== 'cancelled' && !awaitingPatient && <Link className="btn ghost sm" to={`/patients/${a.patient._id}`}>Open Patient Record</Link>}
      </div>
    </div>
  );
}

function DateTimeFields({ f, set }) {
  return (
    <div className="form-grid">
      <Field label="Date"><input className="input" type="date" min={todayStr()} value={f.date} onChange={set('date')} required /></Field>
      <Field label="Time"><input className="input" type="time" value={f.time} onChange={set('time')} required /></Field>
    </div>
  );
}
// Date + time are entered in the person's own timezone and sent as an exact instant, so both accounts agree on the moment.
function whenOf(f) {
  if (!f.date || !f.time) return { error: 'Please choose a date and time.' };
  const iso = toISO(f.date, f.time);
  if (new Date(iso) < new Date()) return { error: 'Please choose a date and time in the future.' };
  return { iso };
}

function BookModal({ doctors, onClose, onDone }) {
  const [f, setF] = useState({ doctor: '', date: '', time: '10:00', reason: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setErr('');
    const w = whenOf(f); if (w.error) return setErr(w.error);
    setBusy(true);
    try { await api.post('/appointments', { doctor: f.doctor, date: w.iso, reason: f.reason }); onDone(); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Book an Appointment" onClose={onClose}>
      <form className="t-lav" onSubmit={save}>
        <ErrBox msg={err} />
        {doctors && doctors.length === 0 && <div className="err">No doctors have joined RuralCare yet.</div>}
        <Field label="Choose a doctor"><select className="select" value={f.doctor} onChange={set('doctor')} required>
          <option value="">Select doctor…</option>{(doctors || []).map((d) => <option key={d._id} value={d._id}>{doctorName(d.name)} — {d.specialization}</option>)}</select></Field>
        <DateTimeFields f={f} set={set} />
        <Field label="Reason for visit (optional)"><input className="input" value={f.reason} onChange={set('reason')} placeholder="e.g. Fever and cough" maxLength={200} /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'Booking…' : 'Request Appointment'}</button>
        <p className="muted small" style={{ marginTop: 10, textAlign: 'center' }}>Your doctor will confirm the time.</p>
      </form>
    </Modal>
  );
}

// Doctor creates an appointment for one of their patients, or for a new patient found by Patient ID.
function CreateModal({ onClose, onDone }) {
  const { data: patients } = useApi('/users/patients');
  const [f, setF] = useState({ patient: '', date: '', time: '10:00', reason: '' });
  const [code, setCode] = useState(''); const [found, setFound] = useState(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [looking, setLooking] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const look = async () => {
    setErr(''); setFound(null); setLooking(true);
    try { const p = await api.get(`/users/patients/lookup?patientId=${encodeURIComponent(code.trim())}`); setFound(p); setF((x) => ({ ...x, patient: p._id })); }
    catch (ex) { setErr(ex.message); } finally { setLooking(false); }
  };
  const isNew = found && !(patients || []).some((p) => p._id === found._id);
  const save = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.patient) return setErr('Please choose a patient.');
    const w = whenOf(f); if (w.error) return setErr(w.error);
    setBusy(true);
    try { await api.post('/appointments', { patient: f.patient, date: w.iso, reason: f.reason }); onDone(); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="New Appointment" onClose={onClose}>
      <form className="t-lav" onSubmit={save}>
        <ErrBox msg={err} />
        <Field label="Patient"><select className="select" value={found ? '' : f.patient} onChange={(e) => { setFound(null); setF({ ...f, patient: e.target.value }); }}>
          <option value="">{found ? `${found.name} (${found.patientId})` : 'Select one of your patients…'}</option>
          {(patients || []).map((p) => <option key={p._id} value={p._id}>{p.name} ({p.patientId})</option>)}</select></Field>
        <Field label="Or find a new patient by Patient ID">
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="RC-12345" maxLength={9} />
            <button type="button" className="btn ghost" onClick={look} disabled={!code.trim() || looking}><Search size={16} /> {looking ? 'Searching…' : 'Find'}</button>
          </div>
        </Field>
        {isNew && <div className="ok note">{found.name} hasn't seen you before. They must accept this appointment before you can open their records.</div>}
        <DateTimeFields f={f} set={set} />
        <Field label="Reason (optional)"><input className="input" value={f.reason} onChange={set('reason')} placeholder="e.g. Follow-up visit" maxLength={200} /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'Saving…' : 'Create Appointment'}</button>
      </form>
    </Modal>
  );
}

export default function Appointments() {
  const { user } = useAuth();
  const isDoc = user.role === 'doctor';
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApi('/appointments', { poll: 15000 });
  const { data: doctors } = useApi(isDoc ? null : '/users/doctors');
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null);
  const [f, setF] = useState({ date: '', time: '10:00' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => { if (params.get('book') && !isDoc) { setModal({ type: 'book' }); setParams({}, { replace: true }); } }, [params, isDoc, setParams]);

  const onAction = async (kind, a) => {
    setErr('');
    if (kind === 'resched') { setF({ date: localDate(new Date(a.date)), time: timeInput(a.date) }); return setModal({ type: 'resched', a }); }
    if (kind === 'cancel') return setModal({ type: 'cancel', a });
    const status = kind === 'complete' ? 'completed' : 'confirmed'; // confirm / accept / complete
    try { await api.patch(`/appointments/${a._id}`, { status }); reload(); } catch (ex) { setErr(ex.message); reload(); }
  };
  const submitModal = async (e) => {
    e?.preventDefault(); setErr('');
    const a = modal.a;
    let body;
    if (modal.type === 'cancel') body = { status: 'cancelled' };
    else { const w = whenOf(f); if (w.error) return setErr(w.error); body = { date: w.iso }; }
    setBusy(true);
    try { await api.patch(`/appointments/${a._id}`, body); setModal(null); reload(); }
    catch (ex) { setErr(ex.message); reload(); } finally { setBusy(false); }
  };
  const closeModal = () => { setModal(null); setErr(''); };

  const now = new Date();
  const all = data || [];
  const upcoming = all.filter((a) => new Date(a.date) >= now && LIVE.includes(a.status));
  const past = all.filter((a) => !upcoming.includes(a)).reverse();
  const shown = sel ? upcoming.filter((a) => isSameDay(a.date, sel)) : upcoming;
  const marked = new Set(all.filter((a) => a.status !== 'cancelled').map((a) => new Date(a.date).toDateString()));

  const y = month.getFullYear(), m = month.getMonth();
  const cells = [...Array(new Date(y, m, 1).getDay()).fill(null), ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => new Date(y, m, i + 1))];

  return (
    <div className="t-lav">
      <PageHead title="Appointments" sub={isDoc ? 'Manage your patient visits.' : 'Your visits with your doctors.'}>
        <button className="btn" onClick={() => { setErr(''); setModal({ type: isDoc ? 'create' : 'book' }); }}><Plus size={18} /> {isDoc ? 'New Appointment' : 'Book an Appointment'}</button>
      </PageHead>
      {err && !modal && <ErrBox msg={err} />}
      {error ? <ErrorState text="We couldn't load your appointments." onRetry={reload} /> : (
        <div className="cols cols-cal">
          <div className="card" style={{ position: 'sticky', top: 90 }}>
            {loading ? <Skeleton h={320} /> : <>
              <div className="cal-head">
                <button className="icon-btn" onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label="Previous month"><ChevronLeft size={20} /></button>
                <h3>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
                <button className="icon-btn" onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label="Next month"><ChevronRight size={20} /></button>
              </div>
              <div className="cal">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="dow">{d}</div>)}
                {cells.map((d, i) => d ? (
                  <button key={i} className={[isSameDay(d, now) && 'today', sel && isSameDay(d, sel) && 'sel', marked.has(d.toDateString()) && 'has'].filter(Boolean).join(' ')}
                    onClick={() => setSel(sel && isSameDay(d, sel) ? null : d)} aria-label={`${fmtDate(d)}${marked.has(d.toDateString()) ? ', has appointment' : ''}`}>{d.getDate()}</button>
                ) : <button key={i} className="out" disabled />)}
              </div>
              <p className="muted small" style={{ marginTop: 14 }}>● Days with appointments. Tap a day to filter.</p>
              {sel && <button className="link small" onClick={() => setSel(null)}>Show all upcoming</button>}
            </>}
          </div>

          <div className="stack">
            <div>
              <div className="h2">Upcoming Appointments</div>
              {loading ? <SkeletonCards n={2} h={110} /> : shown.length === 0 ? (
                <Empty icon="📅" title="No upcoming appointments" text={sel ? 'Nothing on this day.' : undefined} action={<button className="btn" onClick={() => setModal({ type: isDoc ? 'create' : 'book' })}>{isDoc ? 'New Appointment' : 'Book an Appointment'}</button>} />
              ) : <div className="stack" style={{ gap: 14 }}>{shown.map((a) => <ApptCard key={a._id} a={a} isDoc={isDoc} onAction={onAction} />)}</div>}
            </div>
            {!loading && past.length > 0 && (
              <div>
                <div className="h2" style={{ color: 'var(--muted)' }}>Past Appointments</div>
                <div className="stack" style={{ gap: 12 }}>{past.map((a) => <ApptCard key={a._id} a={a} isDoc={isDoc} past onAction={onAction} />)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {modal?.type === 'book' && <BookModal doctors={doctors} onClose={closeModal} onDone={() => { setModal(null); reload(); }} />}
      {modal?.type === 'create' && <CreateModal onClose={closeModal} onDone={() => { setModal(null); reload(); }} />}
      {modal?.type === 'resched' && (
        <Modal title="Reschedule Appointment" onClose={closeModal}>
          <form onSubmit={submitModal}><ErrBox msg={err} />
            <p className="muted small" style={{ marginBottom: 12 }}>Currently {short(modal.a.date)}</p>
            <DateTimeFields f={f} set={(k) => (e) => setF({ ...f, [k]: e.target.value })} />
            <button className="btn block" disabled={busy}>{busy ? 'Saving…' : 'Save New Time'}</button>
            <p className="muted small" style={{ marginTop: 10, textAlign: 'center' }}>{isDoc ? 'The patient will see the new time straight away.' : 'Your doctor will need to confirm the new time.'}</p></form>
        </Modal>
      )}
      {modal?.type === 'cancel' && (
        <Modal title={isDoc && modal.a.status === 'pending' && modal.a.createdBy !== 'doctor' ? 'Decline this appointment?' : !isDoc && modal.a.createdBy === 'doctor' && modal.a.status === 'pending' ? 'Decline this appointment?' : 'Cancel this appointment?'} onClose={closeModal}>
          <ErrBox msg={err} />
          <p className="muted" style={{ marginBottom: 20 }}>{fmtDate(modal.a.date)} at {fmtTime(modal.a.date)}. This cannot be undone.</p>
          <div className="row"><button className="btn ghost" onClick={closeModal}>Keep it</button><button className="btn danger" onClick={submitModal} disabled={busy}>{busy ? 'Please wait…' : 'Yes, cancel'}</button></div>
        </Modal>
      )}
    </div>
  );
}
