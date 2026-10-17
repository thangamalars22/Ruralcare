import { useState } from 'react';
import { Mail, MapPin, Phone, Stethoscope, Building2, Cake, IdCard } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Avatar, ErrBox, Field, PageHead } from '../components/ui.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const isDoc = user.role === 'doctor';
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({});
  const [err, setErr] = useState(''); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const start = () => { setF({ name: user.name, phone: user.phone || '', age: user.age ?? '', address: user.address || '', specialization: user.specialization || '', clinic: user.clinic || '' }); setErr(''); setOk(false); setEdit(true); };
  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const d = await api.put('/auth/me', f); setUser(d.user); setEdit(false); setOk(true); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  const Item = ({ icon: Icon, l, v }) => <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><div className="rec-ico"><Icon size={22} color="var(--accent-d)" /></div><div><div className="field-l">{l}</div><div className="field-v">{v || '—'}</div></div></div>;

  return (
    <div className={isDoc ? 't-blue' : 't-teal'}>
      <PageHead title="My Profile">{!edit && <button className="btn" onClick={start}>Edit Profile</button>}</PageHead>
      {ok && <div className="ok" role="status">✅ Your changes have been saved.</div>}
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="pt-head" style={{ marginBottom: 26 }}>
          <Avatar name={user.name} size={88} doctor={isDoc} />
          <div><h2 style={{ fontSize: '1.6rem', letterSpacing: '-.02em' }}>{user.name}</h2>
            <div className="muted">{isDoc ? user.specialization : `Patient ID: ${user.patientId}`}</div><span className="role-pill" style={{ marginTop: 6 }}>{user.role}</span></div>
        </div>
        {!edit ? (
          <div className="grid g2" style={{ gap: 22 }}>
            {isDoc ? <><Item icon={Stethoscope} l="Specialization" v={user.specialization} /><Item icon={Building2} l="Hospital / Clinic" v={user.clinic} /></>
              : <><Item icon={IdCard} l="Patient ID" v={user.patientId} /><Item icon={Cake} l="Age" v={user.age != null && `${user.age} years`} /></>}
            <Item icon={Mail} l="Email" v={user.email} /><Item icon={Phone} l="Phone" v={user.phone} />
            {!isDoc && <Item icon={MapPin} l="Address" v={user.address} />}
          </div>
        ) : (
          <form onSubmit={save}>
            <ErrBox msg={err} />
            <div className="form-grid">
              <Field label="Name"><input className="input" value={f.name} onChange={set('name')} required /></Field>
              <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
              {isDoc ? <><Field label="Specialization"><input className="input" value={f.specialization} onChange={set('specialization')} /></Field>
                <Field label="Hospital / Clinic"><input className="input" value={f.clinic} onChange={set('clinic')} /></Field></>
                : <Field label="Age"><input className="input" type="number" value={f.age} onChange={set('age')} /></Field>}
            </div>
            {!isDoc && <Field label="Address"><textarea className="textarea" value={f.address} onChange={set('address')} /></Field>}
            <p className="muted small" style={{ marginBottom: 16 }}>Your email cannot be changed here.</p>
            <div className="row"><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button><button type="button" className="btn ghost" onClick={() => setEdit(false)}>Cancel</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
