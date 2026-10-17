import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { PageHead } from '../components/ui.jsx';

const SIZES = [['normal', 'Normal', 'Aa'], ['large', 'Large', 'Aa'], ['xl', 'Extra large', 'Aa']];

export default function Settings() {
  const { logout } = useAuth();
  const [size, setSize] = useState(localStorage.getItem('rc_text') || 'normal');
  const [lang, setLang] = useState(localStorage.getItem('rc_voice_lang') || 'en-IN');
  const [speak, setSpeak] = useState(localStorage.getItem('rc_voice_speak') !== 'off');
  const pickSize = (s) => { setSize(s); localStorage.setItem('rc_text', s); document.documentElement.dataset.text = s; };
  return (
    <div className="t-teal">
      <PageHead title="Settings" sub="Make RuralCare easy to use for you." />
      <div className="stack" style={{ maxWidth: 680 }}>
        <div className="card"><div className="h2">Text size</div>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 0 }}>
            {SIZES.map(([k, l], i) => <button key={k} className={size === k ? 'on' : ''} onClick={() => pickSize(k)} style={{ flexDirection: 'column', gap: 0 }}><span style={{ fontSize: `${1 + i * 0.3}rem` }}>Aa</span><small>{l}</small></button>)}
          </div></div>
        <div className="card"><div className="h2">Voice assistant</div>
          <div className="field"><label htmlFor="vl">Language I speak</label>
            <select id="vl" className="select" value={lang} onChange={(e) => { setLang(e.target.value); localStorage.setItem('rc_voice_lang', e.target.value); }}>
              <option value="en-IN">English (India)</option><option value="ta-IN">தமிழ் (Tamil)</option><option value="hi-IN">हिन्दी (Hindi)</option><option value="en-US">English (US)</option></select>
            <span className="muted small">Language support depends on your browser and device.</span></div>
          <label className="check"><span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontWeight: 700 }}>
            <input type="checkbox" checked={speak} onChange={(e) => { setSpeak(e.target.checked); localStorage.setItem('rc_voice_speak', e.target.checked ? 'on' : 'off'); }} style={{ width: 22, height: 22 }} /> Read answers aloud</span></label></div>
        <div className="card"><div className="h2">Account</div><button className="btn danger" onClick={logout}><LogOut size={18} /> Log out</button></div>
      </div>
    </div>
  );
}
