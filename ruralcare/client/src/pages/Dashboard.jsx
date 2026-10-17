import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Pill, FileText, Users, Clock, MessageCircle, Activity, Weight, Droplet, Droplets, Mic, Upload } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { api } from '../api.js';
import { greeting, firstName, localDate, fmtDate, fmtDay, fmtShort, fmtTime, doctorName } from '../utils.js';
import { Avatar, Skeleton, SkeletonCards, Empty, ErrorState, StatusBadge } from '../components/ui.jsx';
import { BannerArt } from '../components/Illustration.jsx';
import { typeIcon, typeLabel } from '../reports.js';

function Stat({ tone, icon: Icon, label, value, sub }) {
  return (
    <div className={`stat tone-${tone}`}>
      <div className="ico"><Icon size={26} aria-hidden="true" /></div>
      <div className="label">{label}</div><div className="value">{value}</div><div className="sub">{sub}</div>
    </div>
  );
}

function PatientDashboard({ user }) {
  const { data: s, loading, error, reload } = useApi('/summary', { poll: 20000 });
  const { data: recs } = useApi('/records', { poll: 30000 });
  if (error) return <ErrorState title="Something went wrong." text="We couldn't load your health overview." onRetry={reload} />;
  const next = s?.nextAppointment;
  const v = s?.vitals;
  return (
    <div className="stack">
      <div className="banner">
        <div><h1>{greeting()}, {firstName(user.name)}!</h1><p>Take care of your health — it's the key to a better tomorrow.</p></div>
        <BannerArt className="b-ill" />
      </div>

      {loading ? <div className="grid g3"><Skeleton h={170} r={16} /><Skeleton h={170} r={16} /><Skeleton h={170} r={16} /></div> : (
        <div className="grid g3">
          <div className="sum-card">
            <div className="sc-head"><span className="sc-ico"><CalendarDays size={22} aria-hidden="true" /></span>Upcoming Appointment</div>
            {next ? <>
              <div className="sc-val">{fmtDate(next.date, { day: '2-digit', month: 'short', year: 'numeric' })} • {fmtTime(next.date)}</div>
              <div className="sc-sub">{doctorName(next.doctor.name)}{next.reason ? ` · ${next.reason}` : ''}</div>
              <Link to="/appointments" className="btn sm">View Details</Link>
            </> : <>
              <div className="sc-val">None booked</div><div className="sc-sub">Book a visit with your doctor.</div>
              <Link to="/appointments?book=1" className="btn sm">Book Appointment</Link>
            </>}
          </div>
          <div className="sum-card">
            <div className="sc-head"><span className="sc-ico"><FileText size={22} aria-hidden="true" /></span>Medical Records</div>
            <div className="sc-val">{s.records} Record{s.records === 1 ? '' : 's'}</div>
            <div className="sc-sub">{s.lastCheckup ? `Latest: ${fmtDay(s.lastCheckup, { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Saved securely'}</div>
            <Link to="/records" className="btn soft sm">View All</Link>
          </div>
          <div className="sum-card">
            <div className="sc-head"><span className="sc-ico"><Pill size={22} aria-hidden="true" /></span>Prescriptions</div>
            <div className="sc-val">{s.activePrescriptions} Prescription{s.activePrescriptions === 1 ? '' : 's'}</div>
            <div className="sc-sub">Active medicines to take</div>
            <Link to="/prescriptions" className="btn soft sm">View All</Link>
          </div>
        </div>
      )}

      <div className="cols">
        <div className="stack">
          <div className="card">
            <div className="h2">Quick Actions</div>
            <div className="qa-grid">
              <Link to="/appointments?book=1" className="qa"><CalendarPlus size={26} aria-hidden="true" />Book Appointment</Link>
              <Link to="/records" className="qa"><FileText size={26} aria-hidden="true" />View Records</Link>
              <Link to="/prescriptions" className="qa"><Pill size={26} aria-hidden="true" />View Prescriptions</Link>
              <Link to="/voice" className="qa"><Mic size={26} aria-hidden="true" />Voice Assistant</Link>
            </div>
          </div>
          <div className="card">
            <div className="h2">Health Overview</div>
            {loading ? <Skeleton h={160} /> : (
              <div className="grid g2" style={{ gap: 14 }}>
                {[[Droplet, 'Blood Sugar', v?.bloodSugar ? <>{v.bloodSugar} <small>mg/dL</small></> : null],
                  [Activity, 'Heart Rate', v?.heartRate ? <>{v.heartRate} <small>BPM</small></> : null],
                  [Droplets, 'Blood Pressure', v?.bloodPressure || null],
                  [Weight, 'Weight', v?.weightKg ? <>{v.weightKg} <small>KG</small></> : null]].map(([Icon, label, val]) => (
                  <div className="vital" key={label}><div className="field-l" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon size={15} /> {label}</div>
                    {val ? <div className="v">{val}</div> : <div className="nodata">No data available</div>}</div>
                ))}
              </div>
            )}
            {v?.recordedOn && <p className="muted small" style={{ marginTop: 12 }}>Latest measurements from {fmtDay(v.recordedOn)}.</p>}
          </div>
        </div>

        <div className="card">
          <div className="h2">Recent Medical Reports <Link to="/records" className="link small">View all</Link></div>
          {!recs ? <Skeleton h={160} /> : recs.length === 0 ? <p className="muted">No medical records available yet. Reports added by your doctor will appear here.</p> : recs.slice(0, 5).map((r) => (
            <div className="rep-row" key={r._id}>
              <div className="rr-ico" aria-hidden="true">{typeIcon(r.reportType)}</div>
              <div className="rr-t"><b>{r.title}</b><div className="rr-d">{typeLabel(r.reportType)} · {fmtDay(r.visitDate, { day: '2-digit', month: 'short', year: 'numeric' })}</div></div>
              <Link to="/records" className="link small">View</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoctorDashboard({ user }) {
  // "Today" in the doctor's own timezone. Re-evaluated every minute so a tab left open overnight rolls over to the new day.
  const [day, setDay] = useState(localDate);
  useEffect(() => { const t = setInterval(() => setDay(localDate()), 60000); return () => clearInterval(t); }, []);
  const range = useMemo(() => {
    const [y, m, d] = day.split('-').map(Number);
    return `from=${new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()}&to=${new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()}`;
  }, [day]);
  const { data: s, loading, error, reload } = useApi(`/summary?${range}`, { poll: 20000 });
  const [busy, setBusy] = useState('');
  const act = async (id, status) => { setBusy(id); try { await api.patch(`/appointments/${id}`, { status }); reload(); } catch { /* shown by reload state */ } finally { setBusy(''); } };
  if (error) return <ErrorState text="We couldn't load your clinical overview." onRetry={reload} />;
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}><div><h1>{greeting()}, Dr. {firstName(user.name)}!</h1><p>Here's your clinical overview.</p></div>
        <Link to="/patients" className="btn"><Upload size={18} /> Upload Medical Report</Link></div>
      {loading ? <div className="grid g4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={150} r={24} />)}</div> : (
        <div className="grid g4">
          <Stat tone="teal" icon={Users} label="My Patients" value={s.totalPatients} sub="Booked with you" />
          <Stat tone="blue" icon={CalendarDays} label="Today's Appointments" value={s.todayCount} sub="Scheduled today" />
          <Stat tone="orange" icon={Clock} label="Pending Requests" value={s.pending} sub="Need your reply" />
          <Stat tone="blue" icon={MessageCircle} label="Unread Messages" value={s.unread} sub="From patients" />
        </div>
      )}
      <div className="cols">
        <div>
          <div className="h2">Today's Appointments</div>
          {loading ? <SkeletonCards n={2} h={70} /> : s.today.length === 0 ? <Empty icon="📅" title="No appointments today" text="Enjoy a calm day." /> : (
            <div className="timeline">{s.today.map((a) => (
              <div className="tl-item" key={a._id}><div className="card hover pt-row">
                <div className="date-tile compact"><b>{fmtTime(a.date).split(' ')[0]}</b><span>{fmtTime(a.date).split(' ')[1]}</span></div>
                <Avatar name={a.patient.name} size={46} />
                <div className="info"><h3>{a.patient.name}</h3><div className="muted small">{a.reason}</div></div>
                <StatusBadge status={a.status} />
                <Link to={`/patients/${a.patient._id}`} className="btn sm">Open Patient Record</Link>
              </div></div>))}</div>
          )}
        </div>
        <div className="card t-orange">
          <div className="h2">Pending Requests</div>
          {loading ? <Skeleton h={120} /> : s.pendingList.length === 0 ? <p className="muted">No pending requests. ✅</p> : s.pendingList.map((a) => (
            <div key={a._id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <b>{a.patient.name}</b><div className="muted small">{fmtDate(a.date)} · {fmtTime(a.date)}</div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn sm t-green" disabled={busy === a._id} onClick={() => act(a._id, 'confirmed')}>Confirm</button>
                <button className="btn danger sm" disabled={busy === a._id} onClick={() => act(a._id, 'cancelled')}>Decline</button>
              </div>
            </div>))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'doctor' ? <DoctorDashboard user={user} /> : <PatientDashboard user={user} />;
}
