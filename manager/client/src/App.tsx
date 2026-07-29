import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Resources from './pages/Resources';
import CreateProject from './pages/CreateProject';
import { checkAuth } from './api';
import { ThemeProvider } from './contexts/ThemeContext';

// Protected Route Wrapper
const ProtectedRoute = ({ children, authenticated, loading }: { children: React.ReactElement; authenticated: boolean; loading: boolean }) => {
  const location = useLocation();

  if (loading) return null;
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Layout Wrapper
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [, setServerOnline] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setServerOnline(res.ok);
      } catch { setServerOnline(false); }
    };
    checkHealth();
    const timer = setInterval(checkHealth, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen font-sans relative">
      {/* LanguageSwitcher removed from global layout */}
      {/* Global Fluid Background */}
      <div className="fluid-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuth().then(result => {
      setAuthenticated(result);
      setAuthLoading(false);
    });
    const handleExpired = () => setAuthenticated(false);
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/login" element={<LoginWrapper onAuthenticated={() => setAuthenticated(true)} />} />
            <Route path="/" element={
              <ProtectedRoute authenticated={authenticated} loading={authLoading}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/resources" element={
              <ProtectedRoute authenticated={authenticated} loading={authLoading}>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/create" element={
              <ProtectedRoute authenticated={authenticated} loading={authLoading}>
                <CreateProject />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </Router>
    </ThemeProvider>
  );
}

// Login Wrapper to handle redirect
const LoginWrapper = ({ onAuthenticated }: { onAuthenticated: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = () => {
    onAuthenticated();
    const state = location.state as { from?: { pathname?: string } } | null;
    const from = state?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  return <Login onLogin={handleLogin} />;
};

export default App;
