import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Athletes from './pages/Athletes';
import Scanner from './pages/Scanner';
import Events from './pages/Events';
import Scoring from './pages/Scoring';
import Scoreboard from './pages/Scoreboard';
import Certificates from './pages/Certificates';
import LiveScoreboard from './pages/LiveScoreboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/live" element={<LiveScoreboard />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/athletes" element={<AdminRoute><Athletes /></AdminRoute>} />
        <Route path="/scanner" element={<AdminRoute><Scanner /></AdminRoute>} />
        <Route path="/events" element={<Events />} />
        <Route path="/scoring" element={<AdminRoute><Scoring /></AdminRoute>} />
        <Route path="/scoreboard" element={<Scoreboard />} />
        <Route path="/certificates" element={<AdminRoute><Certificates /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
