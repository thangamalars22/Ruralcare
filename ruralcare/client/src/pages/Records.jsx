import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApi } from '../hooks.js';
import { Empty, ErrorState, PageHead, SkeletonCards } from '../components/ui.jsx';
import { RecordTimeline } from '../components/Clinical.jsx';
import { REPORT_TYPES, typeLabel } from '../reports.js';
import { fmtDay } from '../utils.js';

// Patient view of everything their doctors have added — newest first, with search and filters.
export default function Records() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('new');
  const { data, loading, error, reload } = useApi('/records', { poll: 20000 });
  useEffect(() => { setQ(params.get('q') || ''); }, [params]); // the top-bar search also feeds this box

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = (data || []).filter((r) => (type === 'all' || r.reportType === type) && (!needle || [
      r.title, r.diagnosis, r.results, r.notes, r.treatment, r.symptoms, r.doctor?.name, typeLabel(r.reportType), r.file?.originalName, fmtDay(r.visitDate),
    ].some((x) => x?.toLowerCase().includes(needle))));
    out.sort((a, b) => (sort === 'new' ? 1 : -1) * (new Date(b.visitDate) - new Date(a.visitDate)));
    return out;
  }, [data, q, type, sort]);

  const filtered = q.trim() || type !== 'all';
  return (
    <div className="t-blue">
      <PageHead title="Medical Records" sub="Your complete health history, in one place — reports added by your doctors appear here automatically." />
      {data?.length > 0 && (
        <div className="filters">
          <div className="search" role="search"><Search size={18} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search medical records" placeholder="Search by title, diagnosis, doctor or date" /></div>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by report type">
            <option value="all">All report types</option>{REPORT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort records">
            <option value="new">Newest first</option><option value="old">Oldest first</option></select>
        </div>
      )}
      {loading ? <SkeletonCards n={3} h={70} /> : error ? <ErrorState text="We couldn't load your medical records." onRetry={reload} />
        : list.length === 0 ? <Empty icon="🩺" title={filtered ? 'No records match your search.' : 'No medical records available yet.'} text={filtered ? 'Try a different word or clear the filters.' : 'After a visit, your doctor will add your records and reports here.'}
          action={filtered ? <button className="btn ghost" onClick={() => { setQ(''); setType('all'); }}>Clear filters</button> : null} />
        : <>
          <p className="muted small" style={{ marginBottom: 14 }}>{list.length} record{list.length > 1 ? 's' : ''}{filtered ? ' found' : ''}</p>
          <RecordTimeline records={list} />
        </>}
    </div>
  );
}
