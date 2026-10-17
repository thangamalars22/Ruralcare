import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, Home, Stethoscope, CalendarDays, Pill, MessageCircle, Mic, User, Settings, LogOut, Bell, Search, Menu, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { Logo, LogoMark, Avatar, Modal } from './ui.jsx';
import VoicePanel from './VoicePanel.jsx';
import { EcgLine } from './Illustration.jsx';

const patientNav = [
  { to: '/', label: 'Dashboard', icon: Home }, { to: '/records', label: 'Medical Records', icon: Stethoscope },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays }, { to: '/prescriptions', label: 'Prescriptions', icon: Pill },
  { to: '/messages', label: 'Messages', icon: MessageCircle, badge: 'unread' }, { to: '/voice', label: 'Voice Assistant', icon: Mic },
  { to: '/profile', label: 'My Profile', icon: User }, { to: '/settings', label: 'Settings', icon: Settings },
];
const doctorNav = [
  { to: '/', label: 'Dashboard', icon: Home }, { to: '/patients', label: 'Patients', icon: Users }, { to: '/medical-records', label: 'Medical Records', icon: FileText },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, badge: 'pending' }, { to: '/prescriptions', label: 'Prescriptions', icon: Pill },
  { to: '/messages', label: 'Messages', icon: MessageCircle, badge: 'unread' }, { to: '/voice', label: 'Voice Assistant', icon: Mic },
  { to: '/profile', label: 'My Profile', icon: User }, { to: '/settings', label: 'Settings', icon: Settings },
];
const bottomPatient = ['/', '/records', '/appointments', '/prescriptions', '/messages'];
const bottomDoctor = ['/', '/patients', '/medical-records', '/appointments', '/messages'];
const shortLabel = { '/': 'Home', '/records': 'Records', '/appointments': 'Visits', '/prescriptions': 'Medicines', '/messages': 'Chat', '/patients': 'Patients', '/profile': 'Profile', '/medical-records': 'Records' };

export default function Shell() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [voice, setVoice] = useState(false);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const isDoc = user.role === 'doctor';
  const items = isDoc ? doctorNav : patientNav;
  const { data: sum } = useApi(`/summary?v=${encodeURIComponent(loc.pathname)}`, { poll: 30000 });
  const counts = { unread: sum?.unread || 0, pending: sum?.pending || 0 };

  useEffect(() => { setDrawer(false); setBell(false); setMenu(false); }, [loc.pathname]);

  const submit = (e) => {
    e.preventDefault();
    nav(`${isDoc ? '/patients' : '/records'}?q=${encodeURIComponent(q.trim())}`);
  };
  const bottom = (isDoc ? bottomDoctor : bottomPatient).map((to) => items.find((i) => i.to === to));
  const notif = counts.unread + counts.pending;

  return (
    <div className="shell">
      <aside className={'sidebar' + (drawer ? ' open' : '')} aria-label="Main navigation">
        <div className="side-inner">
          <Logo />
          <nav className="nav">
            {items.map(({ to, label, icon: Icon, badge }) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon size={21} aria-hidden="true" />{label}
                {badge && counts[badge] > 0 && <span className="badge-n">{counts[badge]}</span>}
              </NavLink>
            ))}
          </nav>
          <EcgLine className="side-ecg" />
          <div className="side-foot">
            <div className="mini"><Avatar name={user.name} size={42} doctor={isDoc} />
              <div><b>{user.name}</b><small>{user.role}</small></div></div>
            <button className="logout" onClick={logout}><LogOut size={18} /> Log out</button>
          </div>
        </div>
      </aside>
      <div className={'overlay' + (drawer ? ' show' : '')} onClick={() => setDrawer(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="mobile-only"><LogoMark size={38} /></div>
          <form className="search" onSubmit={submit} role="search">
            <Search size={19} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search"
              placeholder={isDoc ? 'Search patients by name, phone or ID' : 'Search my medical records'} />
          </form>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => setVoice(true)} aria-label="Voice assistant" title="Voice assistant"><Mic size={21} className="ico-red" /></button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => { setMenu(false); setBell((b) => !b); }} aria-label="Notifications" title="Notifications">
                <Bell size={21} />{notif > 0 && <span className="dot">{notif}</span>}
              </button>
              {bell && (
                <div className="pop" role="menu">
                  <h4>Notifications</h4>
                  {notif === 0 && <p className="muted small" style={{ padding: 8 }}>You're all caught up. 🎉</p>}
                  {counts.unread > 0 && <Link to="/messages">💬 {counts.unread} unread message{counts.unread > 1 ? 's' : ''}</Link>}
                  {counts.pending > 0 && <Link to="/appointments">⏳ {counts.pending} pending request{counts.pending > 1 ? 's' : ''}</Link>}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button className="profile-chip" onClick={() => { setBell(false); setMenu((m) => !m); }} aria-haspopup="menu" aria-expanded={menu} title="Account">
                <Avatar name={user.name} size={36} />
                <div><b>{user.name}</b><span className="role-pill">{user.role}</span></div>
                <ChevronDown size={16} aria-hidden="true" style={{ color: 'var(--muted)' }} />
              </button>
              {menu && (
                <div className="pop" role="menu" style={{ width: 220 }}>
                  <Link to="/profile" role="menuitem"><User size={18} /> My Profile</Link>
                  <Link to="/settings" role="menuitem"><Settings size={18} /> Settings</Link>
                  <button className="pop-item" role="menuitem" onClick={logout}><LogOut size={18} /> Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page" key={loc.pathname}>
          <Outlet />
          <div className="secure" style={{ marginTop: 36 }}>
            <ShieldCheck size={24} aria-hidden="true" />
            <div><b>Secure Medical Records</b><div className="muted small">Your health information is protected. Only you and your care team can see it.</div></div>
          </div>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        {bottom.map(({ to, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={23} aria-hidden="true" />{shortLabel[to]}
          </NavLink>
        ))}
      </nav>
      <button className="fab" onClick={() => setVoice(true)} aria-label="Open voice assistant" title="Voice assistant"><Mic size={30} /></button>
      {voice && <Modal title="🎙️ How can I help you?" onClose={() => setVoice(false)}><VoicePanel onDone={() => setVoice(false)} /></Modal>}
    </div>
  );
}
