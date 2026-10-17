import { PageHead } from '../components/ui.jsx';
import VoicePanel from '../components/VoicePanel.jsx';

export default function Voice() {
  return (
    <div className="t-teal">
      <PageHead title="Voice Assistant 🎙️" sub="No typing needed. Tap the microphone and speak." />
      <div className="card" style={{ maxWidth: 640 }}><VoicePanel /></div>
      <p className="muted small" style={{ marginTop: 14, maxWidth: 640 }}>Voice works best in Chrome or Edge on your phone or computer. You can change the voice language in Settings.</p>
    </div>
  );
}
