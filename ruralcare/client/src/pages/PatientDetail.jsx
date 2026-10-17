import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Plus, Upload } from 'lucide-react';
import { useApi } from '../hooks.js';
import { fmtDate, fmtDay, fmtTime } from '../utils.js';
import { Avatar, Empty, ErrorState, Skeleton, SkeletonCards, StatusBadge } from '../components/ui.jsx';
import { RecordTimeline, RecordCard, RecordForm } from '../components/Clinical.jsx';
import { PrescriptionCard, PrescriptionEditor } from '../components/Prescriptions.jsx';

function Section({ r, empty, children }) {
  if (r.loading && !r.data) return <SkeletonCards n={2} h={80} />;
  if (r.error) return <ErrorState onRetry={r.reload} />;
  if (!r.data || r.data.length === 0) return empty;
  return children(r.data);
}

const TABS = ['Overview', 'Medical History', 'Prescriptions', 'Appointments', 'Notes'];

export default function PatientDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'history' ? 'Medical History' : 'Overview');
  const [modal, setModal] = useState(params.get('add') === '1' ? 'record' : null);
  const [notice, setNotice] = useState('');
  const [rxEdit, setRxEdit] = useState(null);
  const [recEdit, setRecEdit] = useState(null);
  const pt = useApi(`/users/patients/${id}`);
  const recs = useApi(`/records?patient=${id}`, { poll: 30000 });
  const rx = useApi(`/prescriptions?patient=${id}`, { poll: 30000 });
  const appts = useApi(`/appointments?patient=${id}`, { poll: 15000 });

  if (pt.error) return <ErrorState title="We couldn't open this record." text="You may not have access to this patient, or something went wrong." onRetry={pt.reload} />;
  const p = pt.data;
  const done = (r) => () => { setModal(null); r.reload(); };
  const openUpload = () => { setTab('Medical History'); setRecEdit(null); setModal('record'); };
  const closeRecord = () => { setModal(null); setRecEdit(null); if (params.get('add')) setParams({}, { replace: true }); };
  const savedRecord = () => { closeRecord(); recs.reload(); setNotice('Medical record saved. The patient can now see it in their account.'); };
  const manage = { onEdit: (r) => { setRecEdit(r); setModal('record'); }, onChanged: () => { recs.reload(); setNotice('Medical record deleted.'); } };
  const vitals = (recs.data || []).find((r) => r.vitals && (r.vitals.heartRate || r.vitals.bloodPressure || r.vitals.weightKg));

  return (
    <div className="t-blue">
      <Link to="/patients" className="link row" style={{ marginBottom: 14 }}><ArrowLeft size={18} /> All patients</Link>
      <div className="card" style={{ marginBottom: 22 }}>
        {!p ? <Skeleton h={80} /> : (
          <div className="pt-head">
            <Avatar name={p.name} size={76} />
            <div style={{ flex: 1 }}><h1 style={{ fontSize: '1.7rem', letterSpacing: '-.02em' }}>{p.name}</h1>
              <div className="muted">Patient ID: <b style={{ color: 'var(--text)' }}>{p.patientId}</b>{p.age != null ? ` · ${p.age} years` : ''}{p.phone ? ` · ${p.phone}` : ''}</div></div>
            <Link to={`/messages?to=${p._id}`} className="btn ghost"><MessageCircle size={18} /> Message</Link>
            <button className="btn" onClick={openUpload}><Upload size={18} /> Upload Medical Report</button>
          </div>)}
      </div>
      {notice && <div className="ok" role="status">✅ {notice}</div>}
      <div className="tabs-in" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setNotice(''); }}>{t}</button>)}</div>

      {tab === 'Overview' && (
        <div className="grid g2">
          <div className="card"><div className="h2">Patient details</div>
            {!p ? <Skeleton h={100} /> : <div className="kv"><div><div className="field-l">Email</div><div className="field-v">{p.email || '—'}</div></div><div><div className="field-l">Phone</div><div className="field-v">{p.phone || '—'}</div></div><div><div className="field-l">Address</div><div className="field-v">{p.address || '—'}</div></div></div>}</div>
          <div className="card"><div className="h2">Latest measurements</div>
            {recs.loading ? <Skeleton h={80} /> : vitals ? <div className="kv">
              <div><div className="field-l">Heart rate</div><div className="field-v">{vitals.vitals.heartRate ? `${vitals.vitals.heartRate} BPM` : 'No data available'}</div></div>
              <div><div className="field-l">Blood pressure</div><div className="field-v">{vitals.vitals.bloodPressure || 'No data available'}</div></div>
              <div><div className="field-l">Weight</div><div className="field-v">{vitals.vitals.weightKg ? `${vitals.vitals.weightKg} KG` : 'No data available'}</div></div></div> : <p className="muted">No data available</p>}
            {vitals && <p className="muted small" style={{ marginTop: 10 }}>From {fmtDay(vitals.visitDate)}</p>}</div>
          <div className="card" style={{ gridColumn: '1/-1' }}><div className="h2">Recent history</div>
            <Section r={recs} empty={<p className="muted">No records yet.</p>}>{(d) => <div className="timeline">{d.slice(0, 2).map((r) => <div key={r._id} className="tl-item"><RecordCard r={r} manage={manage} /></div>)}</div>}</Section></div>
        </div>
      )}

      {tab === 'Medical History' && <>
        <div style={{ marginBottom: 18 }}><button className="btn" onClick={() => { setRecEdit(null); setModal('record'); }}><Plus size={18} /> Add Medical Record</button></div>
        <Section r={recs} empty={<Empty icon="🩺" title="No medical records yet." text="Add the first record or upload a medical report for this patient." />}>{(d) => <RecordTimeline records={d} manage={manage} />}</Section>
      </>}

      {tab === 'Prescriptions' && <div className="t-green">
        <div style={{ marginBottom: 18 }}><button className="btn" onClick={() => { setRxEdit(null); setModal('rx'); }}><Plus size={18} /> New Prescription</button></div>
        <Section r={rx} empty={<Empty icon="💊" title="No prescriptions yet" text="Create one — it stays private until you publish it." />}>{(d) => <div className="grid g2">{d.map((x) => <PrescriptionCard key={x._id} p={x} isDoc onEdit={(y) => { setRxEdit(y); setModal('rx'); }} onChanged={rx.reload} />)}</div>}</Section></div>}

      {tab === 'Appointments' && (
        <Section r={appts} empty={<Empty icon="📅" title="No appointments" />}>{(d) => <div className="stack" style={{ gap: 12 }}>{[...d].reverse().map((a) => (
          <div key={a._id} className="card pt-row"><div className="info"><b>{fmtDate(a.date)} · {fmtTime(a.date)}</b><div className="muted small">{a.reason}</div></div><StatusBadge status={a.status} /></div>))}</div>}</Section>
      )}

      {tab === 'Notes' && (
        <Section r={recs} empty={<Empty icon="📝" title="No notes yet" text="Notes you add to medical records appear here." />}>{(d) => {
          const withNotes = d.filter((r) => r.notes);
          return withNotes.length === 0 ? <Empty icon="📝" title="No notes yet" text="Notes you add to medical records appear here." /> :
            <div className="stack" style={{ gap: 14 }}>{withNotes.map((r) => <div key={r._id} className="card"><div className="field-l">{fmtDay(r.visitDate)} · {r.title}</div><p style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{r.notes}</p></div>)}</div>;
        }}</Section>
      )}

      {modal === 'record' && p && <RecordForm patient={{ ...p, _id: id }} record={recEdit || undefined} onClose={closeRecord} onSaved={savedRecord} />}
      {modal === 'rx' && p && <PrescriptionEditor patient={{ ...p, _id: id }} prescription={rxEdit || undefined} onClose={() => setModal(null)} onSaved={(published) => { setModal(null); rx.reload(); setNotice(published ? 'Prescription published. The patient can now see and download it.' : 'Saved. Drafts stay private until you publish them.'); }} />}
    </div>
  );
}
