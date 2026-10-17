import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import Shell from './components/Shell.jsx';
import { LogoMark, Skeleton } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Appointments from './pages/Appointments.jsx';
import Records from './pages/Records.jsx';
import DoctorRecords from './pages/DoctorRecords.jsx';
import Prescriptions from './pages/Prescriptions.jsx';
import Messages from './pages/Messages.jsx';
import Voice from './pages/Voice.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash"><div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}><LogoMark size={64} /><Skeleton w={160} h={14} /></div></div>;
  return user ? <Shell /> : <Navigate to="/login" replace />;
}
function Role({ allow, children }) {
  const { user } = useAuth();
  return user.role === allow ? children : <Navigate to="/" replace />;
}
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route element={<Protected />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/voice" element={<Voice />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/records" element={<Role allow="patient"><Records /></Role>} />
            <Route path="/medical-records" element={<Role allow="doctor"><DoctorRecords /></Role>} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/patients" element={<Role allow="doctor"><Patients /></Role>} />
            <Route path="/patients/:id" element={<Role allow="doctor"><PatientDetail /></Role>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
