import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Resources from './pages/Resources';
import CreateProject from './pages/CreateProject';
import { getToken, removeToken } from './api';
import { ThemeProvider } from './contexts/ThemeContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const token = getToken();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Layout Wrapper
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [serverOnline, setServerOnline] = useState(false);

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
  return (
    <ThemeProvider>
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/login" element={<LoginWrapper />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/resources" element={
              <ProtectedRoute>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/create" element={
              <ProtectedRoute>
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
const LoginWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (token: string) => {
    localStorage.setItem('auth_token', token);
    const from = (location.state as any)?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  return <Login onLogin={handleLogin} />;
};

export default App;