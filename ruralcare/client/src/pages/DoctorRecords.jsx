import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, Pencil, Paperclip, Search, Trash2, Upload, X } from 'lucide-react';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { dayInput, doctorName, fmtDate, fmtDay } from '../utils.js';
import { REPORT_TYPES, typeIcon, typeLabel } from '../reports.js';
import { Avatar, Empty, ErrBox, ErrorState, Modal, PageHead, SkeletonCards } from '../components/ui.jsx';
import { FileActions, RecordForm, openRecordFile } from '../components/Clinical.jsx';

const up = (d) => fmtDate(d, { day: '2-digit', month: 'short', year: 'numeric' });

function Row({ r, onView, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hasFile = !!r.file?.originalName;
  const download = async () => { setErr(''); setBusy(true); try { await openRecordFile(r, true); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <tr>
      <td data-label="Patient"><div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Avatar name={r.patient?.name || '?'} size={34} />
        <div><b>{r.patient?.name || 'Patient'}</b><div className="muted small">{r.patient?.patientId}</div></div></div></td>
      <td data-label="Report"><div><b>{r.title}</b>{hasFile && <span className="attach-mini"><Paperclip size={13} /> File</span>}
        {r.diagnosis && <div className="muted small">{r.diagnosis}</div>}</div></td>
      <td data-label="Type"><span className="type-chip">{typeIcon(r.reportType)} {typeLabel(r.reportType)}</span></td>
      <td data-label="Test date">{fmtDay(r.visitDate, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td data-label="Uploaded">{up(r.createdAt)}</td>
      <td data-label="Actions" className="tbl-actions">
        <button className="btn soft sm" onClick={() => onView(r)}><Eye size={14} /> View</button>
        {hasFile && <button className="btn ghost sm" onClick={download} disabled={busy} aria-label={`Download ${r.title}`}>{busy ? <span className="spinner" /> : <Download size={14} />} Download</button>}
        <button className="btn ghost sm" onClick={() => onEdit(r)}><Pencil size={14} /> Edit</button>
        <button className="btn danger sm" onClick={() => onDelete(r)} aria-label={`Delete ${r.title}`}><Trash2 size={14} /></button>
        {err && <div className="field-msg" role="alert">{err}</div>}
      </td>
    </tr>
  );
}

function ViewModal({ r, onClose }) {
  const v = r.vitals || {};
  const F = ({ l, v: val }) => (val ? <div><div className="field-l">{l}</div><div className="field-v">{val}</div></div> : null);
  return (
    <Modal title={r.title} onClose={onClose} wide>
      <div className="rec-fields" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
        <F l="Patient" v={r.patient ? `${r.patient.name} (${r.patient.patientId})` : ''} /><F l="Report type" v={typeLabel(r.reportType)} />
        <F l="Test date" v={fmtDay(r.visitDate)} /><F l="Uploaded on" v={up(r.createdAt)} />
        <F l="Doctor" v={r.doctor && doctorName(r.doctor.name)} /><F l="Diagnosis" v={r.diagnosis} />
        <F l="Test results / findings" v={r.results} /><F l="Description and clinical notes" v={r.notes} />
        <F l="Symptoms" v={r.symptoms} /><F l="Treatment" v={r.treatment} />
        <F l="Blood sugar" v={v.bloodSugar && `${v.bloodSugar} mg/dL`} /><F l="Blood pressure" v={v.bloodPressure} />
        <F l="Heart rate" v={v.heartRate && `${v.heartRate} BPM`} /><F l="Weight" v={v.weightKg && `${v.weightKg} KG`} />
        <F l="Follow-up date" v={r.followUpDate && fmtDay(r.followUpDate)} />
        {r.file?.originalName ? <FileActions r={r} /> : <div className="muted small" style={{ gridColumn: '1/-1' }}>No file is attached to this record.</div>}
      </div>
      <div className="row" style={{ marginTop: 16 }}><button className="btn ghost" onClick={onClose}>Close</button>
        {r.patient?._id && <Link className="btn soft" to={`/patients/${r.patient._id}`}>Open patient record</Link>}</div>
    </Modal>
  );
}

function DeleteModal({ r, onClose, onDone }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => { setBusy(true); setErr(''); try { await api.del(`/records/${r._id}`); onDone(); } catch (e) { setErr(e.message); setBusy(false); } };
  return (
    <Modal title="Delete this medical record?" onClose={busy ? () => {} : onClose}>
      <ErrBox msg={err} />
      <p style={{ marginBottom: 6 }}><b>{r.title}</b> — {r.patient?.name}</p>
      <p className="muted small" style={{ marginBottom: 14 }}>The record and its attached file will be permanently removed, and {r.patient?.name || 'the patient'} will no longer see it in their account. This cannot be undone. Only the doctor who created a record can delete it.</p>
      <label className="remember" style={{ margin: '0 0 16px', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>I understand and want to delete this record.</span></label>
      <div className="row"><button className="btn ghost" onClick={onClose} disabled={busy}>Keep it</button>
        <button className="btn danger" style={{ flex: 1 }} disabled={!ok || busy} onClick={go}>{busy ? 'Deleting…' : 'Delete permanently'}</button></div>
    </Modal>
  );
}

export default function DoctorRecords() {
  const recs = useApi('/records', { poll: 20000 });
  const pts = useApi('/users/patients', { poll: 60000 });
  const [q, setQ] = useState('');
  const [patient, setPatient] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'upload'|'edit'|'view'|'delete', r?, patient? }
  const [notice, setNotice] = useState('');

  const all = recs.data || [];
  const counts = useMemo(() => { const c = {}; all.forEach((r) => { const k = r.patient?._id; if (k) c[k] = (c[k] || 0) + 1; }); return c; }, [all]);
  const needle = q.trim().toLowerCase();
  const list = all.filter((r) => (!patient || r.patient?._id === patient) && (!type || r.reportType === type)
    && (!from || dayInput(r.visitDate) >= from) && (!to || dayInput(r.visitDate) <= to)
    && (!needle || [r.title, r.diagnosis, r.patient?.name, r.patient?.patientId, r.file?.originalName].some((x) => x?.toLowerCase().includes(needle))));
  const filtered = !!(needle || patient || type || from || to);
  const clear = () => { setQ(''); setPatient(''); setType(''); setFrom(''); setTo(''); };
  const patients = pts.data || [];

  const saved = (editing) => (_rec, pat) => {
    const name = pat?.name || 'the patient';
    setModal(null); recs.reload();
    setNotice(editing ? 'Medical record updated.' : `Medical record saved. ${name} can now see it in their account.`);
  };

  return (
    <div className="t-blue">
      <PageHead title="Medical Records" sub="Reports and test results you have added for your patients.">
        <button className="btn" onClick={() => { setNotice(''); setModal({ kind: 'upload', patient }); }}><Upload size={18} /> Upload Medical Record</button>
      </PageHead>
      {notice && <div className="ok" role="status">✅ {notice}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="h2">My Patients {patients.length > 0 && <span className="muted small">{patients.length}</span>}</div>
        {pts.loading ? <div className="sk" style={{ height: 64 }} /> : pts.error ? <p className="muted small">We couldn't load your patients.</p>
          : patients.length === 0 ? <p className="muted">No patients are connected to you yet. Patients appear here after they book an appointment with you, or accept one you create.</p>
            : <div className="pt-strip">{patients.map((p) => (
              <div key={p._id} className={'pt-chip' + (patient === p._id ? ' on' : '')}>
                <button type="button" className="pt-chip-main" onClick={() => setPatient(patient === p._id ? '' : p._id)} aria-pressed={patient === p._id} title="Show only this patient's records">
                  <Avatar name={p.name} size={34} /><div><b>{p.name}</b><div className="muted small">{p.patientId} · {counts[p._id] || 0} record{counts[p._id] === 1 ? '' : 's'}</div></div></button>
                <button type="button" className="icon-btn" style={{ width: 34, height: 34 }} aria-label={`Upload a record for ${p.name}`} title="Upload a record" onClick={() => { setNotice(''); setModal({ kind: 'upload', patient: p._id }); }}><Upload size={15} /></button>
              </div>))}</div>}
      </div>

      <div className="filters">
        <div className="search" role="search"><Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search records" placeholder="Search by patient, report title or diagnosis" /></div>
        <select className="select" value={patient} onChange={(e) => setPatient(e.target.value)} aria-label="Filter by patient"><option value="">All patients</option>
          {patients.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by report type"><option value="">All report types</option>
          {REPORT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="date-f"><span className="muted small">From</span><input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Test date from" /></label>
        <label className="date-f"><span className="muted small">To</span><input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Test date to" /></label>
        {filtered && <button className="btn ghost sm" onClick={clear}><X size={14} /> Clear</button>}
      </div>

      {recs.loading ? <SkeletonCards n={4} h={60} /> : recs.error ? <ErrorState text="We couldn't load your medical records." onRetry={recs.reload} />
        : list.length === 0 ? (
          <Empty icon="🗂️" title={filtered ? 'No records match your search.' : 'No medical records uploaded yet'}
            text={filtered ? 'Try different filters.' : 'Upload a report for one of your patients — it appears in their account straight away.'}
            action={filtered ? <button className="btn ghost" onClick={clear}>Clear filters</button> : <button className="btn" onClick={() => setModal({ kind: 'upload', patient: '' })}>Upload Medical Record</button>} />
        ) : <>
          <p className="muted small" style={{ marginBottom: 10 }}>{list.length} record{list.length === 1 ? '' : 's'}{filtered ? ` of ${all.length}` : ''}</p>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Patient</th><th>Report</th><th>Type</th><th>Test date</th><th>Uploaded</th><th>Actions</th></tr></thead>
              <tbody>{list.map((r) => <Row key={r._id} r={r} onView={(x) => setModal({ kind: 'view', r: x })} onEdit={(x) => { setNotice(''); setModal({ kind: 'edit', r: x }); }} onDelete={(x) => setModal({ kind: 'delete', r: x })} />)}</tbody>
            </table>
          </div>
        </>}

      {modal?.kind === 'upload' && <RecordForm patients={patients} patient={undefined} requireFile onClose={() => setModal(null)} onSaved={saved(false)} key="up" preset={modal.patient} />}
      {modal?.kind === 'edit' && <RecordForm record={modal.r} onClose={() => setModal(null)} onSaved={saved(true)} />}
      {modal?.kind === 'view' && <ViewModal r={modal.r} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && <DeleteModal r={modal.r} onClose={() => setModal(null)} onDone={() => { setModal(null); recs.reload(); setNotice('Medical record deleted.'); }} />}
    </div>
  );
}
