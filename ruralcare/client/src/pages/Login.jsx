import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Mic, Stethoscope, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Logo, ErrBox } from '../components/ui.jsx';
import Illustration from '../components/Illustration.jsx';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// "Remember me" stores only the email/phone and role on this device. The password is never stored.
const loadRemembered = () => { try { return JSON.parse(localStorage.getItem('rc_remember') || 'null'); } catch { return null; } };

export default function Login() {
  const { login } = useAuth();
  const saved = loadRemembered();
  const [role, setRole] = useState(saved?.role || 'patient');
  const [id, setId] = useState(saved?.id || '');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(!!saved);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [fe, setFe] = useState({});
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setNote('');
    const v = {};
    if (!id.trim()) v.id = 'Please enter your email or phone number.';
    if (!pw) v.pw = 'Please enter your password.';
    setFe(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await login(id, pw, role);
      try {
        if (remember) localStorage.setItem('rc_remember', JSON.stringify({ id: id.trim(), role }));
        else localStorage.removeItem('rc_remember');
      } catch { /* storage unavailable – ignore */ }
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  // Voice helps fill the email / phone field only. Passwords are never spoken or recorded.
  const listen = () => {
    if (!SR) return setNote('Voice input is not supported in this browser. Please type instead.');
    const r = new SR(); r.lang = localStorage.getItem('rc_voice_lang') || 'en-IN';
    r.onresult = (e) => {
      const t = e.results[0][0].transcript.toLowerCase().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s+/g, '');
      setId(t); setFe((f) => ({ ...f, id: undefined }));
    };
    r.onend = () => setListening(false); r.onerror = () => { setListening(false); setNote("I couldn't hear you. Please try again."); };
    setListening(true); setNote(''); r.start();
  };

  return (
    <div className="auth">
      <section className="auth-art">
        <Logo dark />
        <div>
          <h1>Healthcare for Every Village</h1>
          <p>Your health records, appointments and care — all in one place. Talk to your doctor, even from your village.</p>
          <div className="tagline">Better Health • Brighter Futures</div>
        </div>
        <Illustration />
      </section>

      <section className="auth-form">
        <form className="auth-box" onSubmit={submit} noValidate>
          <div className="mobile-only" style={{ marginBottom: 18 }}><Logo dark /></div>
          <h2>Welcome Back!</h2>
          <p className="muted" style={{ marginBottom: 22 }}>Login to access your health records.</p>
          <div className="seg" role="tablist" aria-label="I am a">
            <button type="button" className={role === 'patient' ? 'on' : ''} onClick={() => setRole('patient')} role="tab" aria-selected={role === 'patient'}><User size={18} /> Patient</button>
            <button type="button" className={role === 'doctor' ? 'on' : ''} onClick={() => setRole('doctor')} role="tab" aria-selected={role === 'doctor'}><Stethoscope size={18} /> Doctor</button>
          </div>
          <ErrBox msg={err} />
          <div className="field">
            <label htmlFor="lg-id">Email or Phone Number</label>
            <input id="lg-id" className="input" value={id} onChange={(e) => { setId(e.target.value); setFe({ ...fe, id: undefined }); }} autoComplete="username"
              placeholder="Enter your email or phone number" aria-invalid={!!fe.id} aria-describedby={fe.id ? 'lg-id-e' : undefined} />
            {fe.id && <span id="lg-id-e" className="field-msg" role="alert"><AlertCircle size={15} /> {fe.id}</span>}
          </div>
          <div className="field">
            <label htmlFor="lg-pw">Password</label>
            <div className="pw-wrap">
              <input id="lg-pw" className="input" type={show ? 'text' : 'password'} value={pw} onChange={(e) => { setPw(e.target.value); setFe({ ...fe, pw: undefined }); }}
                autoComplete="current-password" placeholder="Enter your password" aria-invalid={!!fe.pw} aria-describedby={fe.pw ? 'lg-pw-e' : undefined} style={{ paddingRight: 54 }} />
              <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>{show ? <EyeOff size={21} /> : <Eye size={21} />}</button>
            </div>
            {fe.pw && <span id="lg-pw-e" className="field-msg" role="alert"><AlertCircle size={15} /> {fe.pw}</span>}
          </div>
          <div className="auth-opts">
            <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <button type="button" className="link small" onClick={() => setNote('Password reset is not available yet. Please contact your clinic for help.')}>Forgot password?</button>
          </div>
          {note && <div className="ok note" role="status">{note}</div>}
          <button className="btn block" disabled={busy} aria-busy={busy}>{busy ? <><span className="spinner" aria-hidden="true" /> Logging in…</> : 'Login'}</button>
          <div className="or">or</div>
          <button type="button" className="btn ghost block" onClick={listen}><Mic size={20} /> {listening ? 'Listening… say your email or phone' : 'Say my email or phone number'}</button>
          <p style={{ textAlign: 'center', marginTop: 24 }} className="muted">Don't have an account? <Link to={`/register?role=${role}`} className="link">Register</Link></p>
          <p className="small muted" style={{ textAlign: 'center', marginTop: 18, display: 'flex', gap: 6, justifyContent: 'center' }}><ShieldCheck size={16} /> Your health information is protected.</p>
        </form>
      </section>
    </div>
  );
}
