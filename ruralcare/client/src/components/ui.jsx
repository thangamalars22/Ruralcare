import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, CheckCheck, Clock, XCircle, X, RefreshCw, ShieldAlert, HeartPulse } from 'lucide-react';

// RuralCare mark: coral heart with a white medical cross and a green leaf.
// `light` = white heart for use on the coral sidebar.
export function LogoMark({ size = 46, light = false }) {
  const heart = light ? '#fff' : '#DC4C4C';
  const cross = light ? '#DC4C4C' : '#fff';
  return (
    <div className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 48 48">
        <path d="M24 42S5 30.5 5 17.5C5 11.2 9.6 7 15 7c3.8 0 7 2 9 5.4C26 9 29.2 7 33 7c5.4 0 10 4.2 10 10.5C43 30.5 24 42 24 42z" fill={heart} />
        <rect x="21" y="14" width="6" height="18" rx="1.8" fill={cross} />
        <rect x="15" y="20" width="18" height="6" rx="1.8" fill={cross} />
        <path d="M27 41c1-8 7-13 16-13-1 8-6 13-16 13z" fill="#15803D" />
        <path d="M29 39c3-4 7-7 11-8" stroke="#D1FAE5" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Logo({ dark = false }) {
  return (
    <div className={'logo' + (dark ? ' dark' : '')}>
      <LogoMark light={!dark} />
      <div><b>Rural<em>Care</em></b><small>Centralized Medical Records Platform</small></div>
    </div>
  );
}

export function Avatar({ name = '?', size = 44 }) {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{initials}</div>;
}

export const Skeleton = ({ h = 18, w = '100%', r = 12 }) => <div className="sk" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;

export function SkeletonCards({ n = 3, h = 120, cols }) {
  return (
    <div className="grid" style={cols ? { gridTemplateColumns: `repeat(${cols},1fr)` } : undefined} role="status" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="card"><Skeleton h={h} r={16} /></div>)}
    </div>
  );
}

export function Empty({ icon = '🩺', title, text, action }) {
  return (
    <div className="empty">
      <div className="e-ico" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : <div style={{ height: 14 }} />}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong.', text = 'We could not load this right now.', onRetry }) {
  return (
    <div className="empty" role="alert" style={{ borderColor: '#F5B5B5' }}>
      <div className="e-ico" aria-hidden="true">😕</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {onRetry && <button className="btn" onClick={onRetry}><RefreshCw size={18} /> Try Again</button>}
    </div>
  );
}

const STATUS = {
  confirmed: [CheckCircle2, 'Confirmed'], pending: [Clock, 'Pending'], cancelled: [XCircle, 'Cancelled'],
  completed: [CheckCheck, 'Completed'], active: [CheckCircle2, 'Active'], expired: [AlertTriangle, 'Expired'],
  draft: [Clock, 'Draft – only you can see this'], good: [HeartPulse, 'Good'], attention: [AlertTriangle, 'Needs attention'], critical: [ShieldAlert, 'Critical'],
};
export function StatusBadge({ status }) {
  const [Icon, label] = STATUS[status] || [Clock, status];
  return <span className={`badge b-${status}`}><Icon size={15} aria-hidden="true" />{label}</span>;
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h"><h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const PageHead = ({ title, sub, children }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children}</div>
);

export const Field = ({ label, children }) => <div className="field"><label>{label}</label>{children}</div>;
export const ErrBox = ({ msg }) => msg ? <div className="err" role="alert">⚠️ <span>{msg}</span></div> : null;
