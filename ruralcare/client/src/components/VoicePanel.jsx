import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, CalendarDays, Stethoscope, Pill, MessageCircle, Clock, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, fmtTime, doctorName } from '../utils.js';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function VoicePanel({ onDone }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const isDoc = user.role === 'doctor';
  const [listening, setListening] = useState(false);
  const [said, setSaid] = useState('');
  const [reply, setReply] = useState('How can I help you?');
  const rec = useRef(null);
  const lang = localStorage.getItem('rc_voice_lang') || 'en-IN';
  const readAloud = localStorage.getItem('rc_voice_speak') !== 'off';

  useEffect(() => () => { rec.current?.abort?.(); window.speechSynthesis?.cancel(); }, []);

  const say = (text) => {
    setReply(text);
    if (readAloud && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      window.speechSynthesis.speak(u);
    }
  };
  const go = (path, text) => { say(text); nav(path); setTimeout(() => onDone?.(), 1400); };

  const run = async (text) => {
    const t = text.toLowerCase();
    const has = (...w) => w.some((x) => t.includes(x));
    try {
      if (has('next appointment', 'when is my', 'எப்போது')) {
        const s = await api.get('/summary');
        if (isDoc) return say(`You have ${s.todayCount} appointments today.`);
        const a = s.nextAppointment;
        return say(a ? `Your next appointment is with ${doctorName(a.doctor.name)} on ${fmtDate(a.date)} at ${fmtTime(a.date)}.` : 'You have no upcoming appointments.');
      }
      if (has('appointment', 'நியமனம்', 'சந்திப்பு')) return go('/appointments', 'Opening your appointments.');
      if (has('record', 'history', 'patient', 'பதிவு')) return go(isDoc ? '/patients' : '/records', isDoc ? 'Opening your patients.' : 'Opening your medical records.');
      if (has('prescription', 'medicine', 'மருந்து')) return go(isDoc ? '/patients' : '/prescriptions', isDoc ? 'Opening your patients.' : 'Opening your prescriptions.');
      if (has('message', 'contact', 'doctor', 'chat', 'செய்தி', 'மருத்துவர்')) return go('/messages', 'Opening your messages.');
      if (has('profile')) return go('/profile', 'Opening your profile.');
      if (has('home', 'dashboard')) return go('/', 'Going to your dashboard.');
      say("Sorry, I didn't understand that. Please tap one of the buttons below.");
    } catch {
      say('Sorry, I could not do that right now. Please try again.');
    }
  };

  const start = () => {
    if (listening) { rec.current?.stop(); return; }
    if (!SR) return say('Voice listening is not supported in this browser. Please tap one of the buttons below.');
    const r = new SR();
    r.lang = lang; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0][0].transcript; setSaid(t); run(t); };
    r.onerror = () => { setListening(false); say("I couldn't hear you. Please tap the microphone and try again."); };
    r.onend = () => setListening(false);
    rec.current = r; setListening(true); setSaid(''); setReply('Listening… please speak now.');
    try { r.start(); } catch { setListening(false); }
  };

  const cmds = isDoc
    ? [[CalendarDays, 'Show my appointments'], [Users, 'Show my patients'], [Clock, 'How many appointments today?', 'when is my next appointment'], [MessageCircle, 'Open my messages']]
    : [[CalendarDays, 'Show my appointments'], [Stethoscope, 'Show my medical records'], [Clock, 'When is my next appointment?'], [Pill, 'Show my prescriptions'], [MessageCircle, 'Contact my doctor']];

  return (
    <div className="t-teal">
      <button className={'mic' + (listening ? ' listening' : '')} onClick={start} aria-label={listening ? 'Stop listening' : 'Start listening'} title="Tap and speak">
        {listening ? <Square size={38} fill="#fff" /> : <Mic size={46} />}
      </button>
      <p className="muted small" style={{ textAlign: 'center', marginBottom: 12 }}>{listening ? 'Listening…' : 'Tap the microphone and speak'}</p>
      <div className="say" aria-live="polite">{said && <div className="muted small">You said: “{said}”</div>}{reply}</div>
      <div className="field-l" style={{ marginBottom: 10 }}>Or tap a command</div>
      <div className="cmds">
        {cmds.map(([Icon, label, text]) => (
          <button key={label} className="cmd" onClick={() => { setSaid(label); run(text || label); }}><Icon size={20} className="ico-red" />{label}</button>
        ))}
      </div>
    </div>
  );
}
