import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Resources from './pages/Resources';
import CreateProject from './pages/CreateProject';
import { getToken, removeToken } from './api'; // Still need raw token utils or move to auth service
import { AuthService } from './services/auth';

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
  const location = useLocation();
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

  const handleLogout = () => {
    removeToken();
    // Force refresh to clear state or navigate
    window.location.href = '/login';
  };

  // Hide nav on login page, though layout wrapper is usually inside protected route
  // But we might want global header?
  // Let's keep it simple: No global layout in this refactor step, pages have their headers.
  // Or we add a simple top bar if not creating?
  // Dashboard has header. Resources has header. CreateProject has header.
  // So we just render children.

  return <div className="min-h-screen bg-gray-950 text-gray-100 font-sans relative">{children}</div>;
};

function App() {
  return (
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
  );
}

// Login Wrapper to handle redirect
const LoginWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (token: string) => {
    // api.ts setToken logic is: localStorage.setItem('auth_token', token);
    // We need to ensure that happens.
    // Login component calls onLogin(token).
    // We should import setToken from api or just set it here.
    localStorage.setItem('auth_token', token);
    const from = (location.state as any)?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  return <Login onLogin={handleLogin} />;
};

export default App;