import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Budgets from './pages/Budgets.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Savings from './pages/Savings.jsx';
import Settings from './pages/Settings.jsx';
import Transactions from './pages/Transactions.jsx';
import { NotFound } from './pages/shared.jsx';

function Booting() {
  return (
    <div className="booting" role="status">
      <span className="visually-hidden">Loading your ledger</span>
    </div>
  );
}

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Booting />;
  if (status !== 'authed') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === 'authed') return <Navigate to="/" replace />;
  return children;
}

function ThemeSync() {
  const { user } = useAuth();
  const { adoptServerTheme } = useTheme();
  const serverTheme = user?.preferences?.theme;
  useEffect(() => {
    if (serverTheme) adoptServerTheme(serverTheme);
  }, [serverTheme, adoptServerTheme]);
  return null;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="savings" element={<Savings />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ThemeSync />
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
