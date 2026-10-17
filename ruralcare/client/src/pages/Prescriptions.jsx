import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { Empty, ErrorState, PageHead, SkeletonCards } from '../components/ui.jsx';
import { PrescriptionCard, PrescriptionEditor } from '../components/Prescriptions.jsx';

const PATIENT_TABS = [['all', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['expired', 'Expired']];
const DOCTOR_TABS = [['all', 'All'], ['draft', 'Drafts'], ['published', 'Published']];

// Shared by both accounts: patients see only their own published prescriptions; doctors manage the ones they wrote.
export default function Prescriptions() {
  const { user } = useAuth();
  const isDoc = user.role === 'doctor';
  const { data, loading, error, reload } = useApi('/prescriptions', { poll: 20000 });
  const [tab, setTab] = useState(isDoc ? 'all' : 'active');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState(null); // { prescription? }
  const [notice, setNotice] = useState('');

  const needle = q.trim().toLowerCase();
  const list = (data || []).filter((p) => {
    const draft = p.publishStatus === 'draft';
    const okTab = tab === 'all' || (isDoc ? (tab === 'draft' ? draft : !draft) : p.status === tab);
    const okQ = !needle || [p.patient?.name, p.patient?.patientId, p.diagnosis, p.rxNumber, ...(p.medicines || []).map((m) => m.name)].some((x) => x?.toLowerCase().includes(needle));
    return okTab && okQ;
  });
  const tabs = isDoc ? DOCTOR_TABS : PATIENT_TABS;

  return (
    <div className="t-green">
      <PageHead title="Prescriptions" sub={isDoc ? 'Write, review and publish prescriptions for your patients.' : 'Your medicines and how to take them.'}>
        {isDoc && <button className="btn" onClick={() => setEditor({})}><Plus size={18} /> New Prescription</button>}
      </PageHead>
      {notice && <div className="ok" role="status">✅ {notice}</div>}
      <div className="filters">
        <div className="tabs" role="tablist" style={{ marginBottom: 0 }}>{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {(data?.length > 0) && <div className="search" role="search"><Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search prescriptions" placeholder={isDoc ? 'Search by patient, diagnosis or medicine' : 'Search by medicine or diagnosis'} /></div>}
      </div>
      {loading ? <SkeletonCards n={3} h={170} cols={2} /> : error ? <ErrorState text="We couldn't load your prescriptions." onRetry={reload} />
        : list.length === 0 ? <Empty icon="💊" title={needle ? 'No prescriptions match your search.' : isDoc ? 'No prescriptions here yet' : tab === 'active' ? 'No active prescriptions' : 'No prescriptions here'}
          text={isDoc ? 'Create a prescription — it stays private until you publish it.' : 'Medicines prescribed by your doctor will appear here.'}
          action={isDoc && !needle ? <button className="btn" onClick={() => setEditor({})}>New Prescription</button> : null} />
          : <div className="grid g2">{list.map((p) => <PrescriptionCard key={p._id} p={p} isDoc={isDoc} showPatient={isDoc} onEdit={(x) => setEditor({ prescription: x })} onChanged={reload} />)}</div>}
      {editor && <PrescriptionEditor prescription={editor.prescription} onClose={() => setEditor(null)}
        onSaved={(published) => { setEditor(null); reload(); setNotice(published ? 'Prescription published. The patient can now see and download it.' : 'Saved. Drafts stay private until you publish them.'); }} />}
    </div>
  );
}
