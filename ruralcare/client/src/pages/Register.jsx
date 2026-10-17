import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Stethoscope, User } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Logo, ErrBox, Field } from '../components/ui.jsx';
import Illustration from '../components/Illustration.jsx';

const LABELS = { patient: ['Personal Information', 'Contact Information', 'Account Security', 'Confirmation'], doctor: ['Professional Information', 'Contact & Clinic', 'Account Security', 'Confirmation'] };

export default function Register() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'doctor' ? 'doctor' : 'patient');
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: '', age: '', address: '', phone: '', email: '', specialization: '', clinic: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isDoc = role === 'doctor';

  const validate = () => {
    if (step === 0) {
      if (!f.name.trim()) return 'Please enter your name.';
      if (!isDoc && (f.age === '' || +f.age < 0 || +f.age > 120)) return 'Please enter a valid age.';
      if (isDoc && !f.specialization.trim()) return 'Please enter your specialization.';
    }
    if (step === 1) {
      if (!f.email.trim() && !f.phone.trim()) return 'Please enter an email or a phone number.';
      if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Please enter a valid email address.';
    }
    if (step === 2) {
      if (f.password.length < 8) return 'Password must be at least 8 characters.';
      if (f.password !== f.confirm) return 'The two passwords do not match.';
    }
    return '';
  };

  const next = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);
    setErr('');
    if (step < 3) return setStep(step + 1);
    setBusy(true);
    try {
      await register({ role, name: f.name, age: f.age, address: f.address, phone: f.phone, email: f.email, specialization: f.specialization, clinic: f.clinic, password: f.password });
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const rows = [['Name', f.name], isDoc ? ['Specialization', f.specialization] : ['Age', f.age], ['Phone', f.phone || '—'], ['Email', f.email || '—'], isDoc ? ['Hospital / Clinic', f.clinic || '—'] : ['Address', f.address || '—']];

  return (
    <div className="auth">
      <section className="auth-art">
        <Logo dark />
        <div>
          <h1>{isDoc ? 'Care for more people, wherever they are.' : 'Your health records, always with you.'}</h1>
          <p>Create your free RuralCare account in a few simple steps.</p>
          <div className="tagline">Better Health • Brighter Futures</div>
        </div>
        <Illustration />
      </section>
      <section className="auth-form">
        <form className="auth-box" onSubmit={next}>
          <div className="mobile-only" style={{ marginBottom: 18 }}><Logo dark /></div>
          <h2>Create Your Account</h2>
          <p className="muted" style={{ marginTop: 4 }}>Join RuralCare for better healthcare.</p>
          <div className="seg" style={{ marginTop: 18, marginBottom: 0 }}>
            <button type="button" className={!isDoc ? 'on' : ''} onClick={() => { setRole('patient'); setStep(0); setErr(''); }}><User size={18} /> Patient</button>
            <button type="button" className={isDoc ? 'on' : ''} onClick={() => { setRole('doctor'); setStep(0); setErr(''); }}><Stethoscope size={18} /> Doctor</button>
          </div>
          <div className="steps" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Step {step + 1} of 4 · {LABELS[role][step]}</p>
          <ErrBox msg={err} />

          {step === 0 && <>
            <Field label={isDoc ? 'Full name' : 'Your name'}><input className="input" value={f.name} onChange={set('name')} autoFocus placeholder={isDoc ? 'Dr. Arun Kumar' : 'Your full name'} /></Field>
            {isDoc
              ? <Field label="Specialization"><input className="input" value={f.specialization} onChange={set('specialization')} placeholder="e.g. General Physician" /></Field>
              : <Field label="Age"><input className="input" type="number" inputMode="numeric" min="0" max="120" value={f.age} onChange={set('age')} placeholder="Age in years" /></Field>}
          </>}
          {step === 1 && <>
            <Field label="Phone number"><input className="input" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="98765 43210" /></Field>
            <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" /></Field>
            <p className="muted small" style={{ marginTop: -8, marginBottom: 14 }}>Enter at least one. You can sign in with either.</p>
            {isDoc
              ? <Field label="Hospital / Clinic (optional)"><input className="input" value={f.clinic} onChange={set('clinic')} placeholder="Clinic or hospital name and place" /></Field>
              : <Field label="Address (optional)"><textarea className="textarea" value={f.address} onChange={set('address')} placeholder="Village / town, district" /></Field>}
          </>}
          {step === 2 && <>
            <Field label="Create a password"><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" placeholder="At least 8 characters" /></Field>
            <Field label="Confirm password"><input className="input" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
          </>}
          {step === 3 && <>
            <p className="muted" style={{ marginBottom: 14 }}>Please check your details.</p>
            <div className="summary">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          </>}

          <div className="row" style={{ marginTop: 8 }}>
            {step > 0 && <button type="button" className="btn ghost" onClick={() => { setStep(step - 1); setErr(''); }}>Back</button>}
            <button className="btn" style={{ flex: 1 }} disabled={busy}>{step === 3 ? (busy ? 'Creating…' : <><Check size={18} /> Register</>) : 'Continue'}</button>
          </div>
          <p style={{ textAlign: 'center', marginTop: 22 }} className="muted">Already have an account? <Link to="/login" className="link">Login</Link></p>
        </form>
      </section>
    </div>
  );
}
