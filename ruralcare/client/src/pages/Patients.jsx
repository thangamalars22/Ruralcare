import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Upload } from 'lucide-react';
import { useApi, useDebounced } from '../hooks.js';
import { fmtDay } from '../utils.js';
import { Avatar, Empty, ErrorState, PageHead, SkeletonCards, StatusBadge } from '../components/ui.jsx';

export default function Patients() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q.trim());
  const { data, loading, error, reload } = useApi(`/users/patients?q=${encodeURIComponent(dq)}`, { poll: 30000 });
  return (
    <div className="t-blue">
      <PageHead title="Patients" sub="Patients who have booked with you." />
      <div className="search" style={{ maxWidth: 640, marginBottom: 22, display: 'block' }}>
        <Search size={20} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search patient" placeholder="Search patient by name, phone number or patient ID" style={{ padding: '17px 18px 17px 48px', fontSize: '1rem' }} />
      </div>
      {loading ? <SkeletonCards n={3} h={60} /> : error ? <ErrorState text="We couldn't load your patients." onRetry={reload} />
        : data.length === 0 ? <Empty icon="👥" title={dq ? 'No patients found' : 'No patients yet'} text={dq ? 'Try a different name, phone number or ID.' : 'Patients appear here after they book an appointment with you.'} />
        : <div className="stack" style={{ gap: 14 }}>{data.map((p) => (
          <div key={p._id} className="card hover pt-row">
            <Avatar name={p.name} size={54} />
            <div className="info"><h3>{p.name}</h3>
              <div className="muted small">{p.patientId} · {p.age != null ? `${p.age} yrs` : 'Age not set'}{p.phone ? ` · ${p.phone}` : ''}</div>
              <div className="small" style={{ marginTop: 4 }}>Last visit: <b>{p.lastVisit ? fmtDay(p.lastVisit) : 'No visits yet'}</b></div></div>
            {p.nextAppointment ? <StatusBadge status={p.nextAppointment.status} /> : <span className="muted small">No upcoming visit</span>}
            <Link to={`/patients/${p._id}?tab=history&add=1`} className="btn ghost sm"><Upload size={16} /> Upload Report</Link>
            <Link to={`/patients/${p._id}`} className="btn sm">Open Medical Record</Link>
          </div>))}</div>}
    </div>
  );
}
