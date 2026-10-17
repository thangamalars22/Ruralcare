import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mic, Paperclip, Send } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { api } from '../api.js';
import { fmtTime, fmtShort, doctorName } from '../utils.js';
import { Avatar, Empty, ErrorState, PageHead, Skeleton } from '../components/ui.jsx';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function Messages() {
  const { user } = useAuth();
  const isDoc = user.role === 'doctor';
  const [params] = useSearchParams();
  const { data: convs, loading, error, reload } = useApi('/messages/conversations', { poll: 15000 });
  const { data: doctors } = useApi(isDoc ? null : '/users/doctors');
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [listening, setListening] = useState(false);
  const end = useRef(null);

  const name = (u) => (u.role === 'doctor' ? doctorName(u.name) : u.name);
  const people = [...(convs || []).map((c) => ({ u: c.user, last: c.last, unread: c.unread }))];
  if (!isDoc) (doctors || []).forEach((d) => { if (!people.find((p) => String(p.u._id) === String(d._id))) people.push({ u: { ...d, role: 'doctor' }, last: null, unread: 0 }); });

  useEffect(() => {
    const to = params.get('to');
    if (to && !active && convs) { const p = people.find((x) => String(x.u._id) === to); if (p) setActive(p.u); }
  }); // eslint-disable-line

  const load = useCallback(async (first) => {
    if (!active) return;
    try { setThread(await api.get(`/messages/thread/${active._id}`)); if (first) reload(); } catch { /* keep old */ }
  }, [active]); // eslint-disable-line

  useEffect(() => { setThread([]); load(true); const t = setInterval(() => load(false), 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    setErr('');
    try { const m = await api.post('/messages', { to: active._id, text }); setThread((t) => [...t, m]); setText(''); reload(); }
    catch (ex) { setErr(ex.message); }
  };
  const dictate = () => {
    if (!SR) return setErr('Voice input is not supported in this browser.');
    const r = new SR(); r.lang = localStorage.getItem('rc_voice_lang') || 'en-IN';
    r.onresult = (e) => setText((t) => (t ? t + ' ' : '') + e.results[0][0].transcript);
    r.onend = () => setListening(false); r.onerror = () => { setListening(false); setErr("I couldn't hear you. Please try again."); };
    setListening(true); r.start();
  };

  return (
    <div className="t-indigo">
      <PageHead title="Messages" sub={isDoc ? 'Talk to your patients.' : 'Talk to your doctor.'} />
      {error ? <ErrorState text="We couldn't load your messages." onRetry={reload} /> : (
        <div className="card chat">
          <div className={'convs' + (active ? ' hide' : '')}>
            {loading && !convs ? <div style={{ padding: 18, display: 'grid', gap: 14 }}><Skeleton h={56} /><Skeleton h={56} /><Skeleton h={56} /></div>
              : people.length === 0 ? <Empty icon="💬" title="No conversations yet" text={isDoc ? 'Patients who book with you will appear here.' : 'No doctors are available yet.'} />
              : people.map(({ u, last, unread }) => (
                <button key={u._id} className={'conv' + (active?._id === u._id ? ' on' : '')} onClick={() => setActive(u)}>
                  <Avatar name={u.name} size={46} doctor={u.role === 'doctor'} />
                  <div className="meta"><b>{name(u)}</b><small>{last ? last.text : u.role === 'doctor' ? u.specialization : u.patientId}</small></div>
                  <div style={{ textAlign: 'right' }}>{last && <div className="muted small">{fmtShort(last.createdAt)}</div>}{unread > 0 && <span className="unread">{unread}</span>}</div>
                </button>))}
          </div>
          <div className={'chat-main' + (active ? '' : ' hide')}>
            {!active ? <div style={{ margin: 'auto', textAlign: 'center' }} className="muted"><div style={{ fontSize: '3rem' }}>💬</div>Select a conversation</div> : <>
              <div className="chat-top">
                <button className="icon-btn mobile-only" onClick={() => setActive(null)} aria-label="Back"><ArrowLeft size={20} /></button>
                <Avatar name={active.name} size={44} doctor={active.role === 'doctor'} />
                <div><b>{name(active)}</b><div className="muted small">{active.role === 'doctor' ? active.specialization : active.patientId}</div></div>
              </div>
              <div className="msgs" aria-live="polite">
                {thread.length === 0 && <p className="muted" style={{ margin: 'auto' }}>No messages yet. Say hello 👋</p>}
                {thread.map((m) => <div key={m._id} className={'bubble ' + (String(m.from) === String(user._id) ? 'me' : 'them')}>{m.text}<small>{fmtTime(m.createdAt)}</small></div>)}
                <div ref={end} />
              </div>
              {err && <div className="err" style={{ margin: '0 18px' }} role="alert">⚠️ {err}</div>}
              <form className="composer" onSubmit={send}>
                <button type="button" className="icon-btn" disabled title="Sending files is not available yet" aria-label="Attach file (not available yet)" style={{ opacity: .45 }}><Paperclip size={20} /></button>
                <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" aria-label="Message" />
                <button type="button" className="icon-btn" onClick={dictate} title="Speak your message" aria-label="Voice input" style={listening ? { background: 'var(--coral-light)', borderColor: 'var(--coral)' } : undefined}><Mic size={20} color={listening ? '#B93838' : '#DC4C4C'} /></button>
                <button className="btn" aria-label="Send"><Send size={18} /> <span className="hide-sm">Send</span></button>
              </form>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
