import React, { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Resources from './pages/Resources';
import CreateProject from './pages/CreateProject';
import Deployments from './pages/Deployments';
import Trash from './pages/Trash';
import SettingsPage from './pages/Settings';
import { checkAuth } from './api';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navigate, Router } from './router';
import { routePathname } from './router-path';
import { useLocation, useNavigate } from './use-router';
import { FeedbackProvider } from './components/ui/FeedbackProvider';
import { Activity, Boxes, FolderKanban, Plus, Settings, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const [serverOnline, setServerOnline] = useState(false);
  const { pathname } = useLocation();
  const activePath = routePathname(pathname);
  const navigate = useNavigate();
  const { t } = useTranslation();

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

  if (activePath === '/login') return <div className="min-h-screen bg-[var(--bg-base)]">{children}</div>;

  const navItems = [
    { path: '/', label: t('projects'), icon: FolderKanban },
    { path: '/deployments', label: t('deployments'), icon: Activity },
    { path: '/resources', label: t('resources'), icon: Boxes },
    { path: '/trash', label: t('trash.title'), icon: Trash2 },
    { path: '/settings', label: t('settings'), icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] font-sans text-[var(--text-main)]">
      <header className="console-topbar">
        <button type="button" className="console-brand" onClick={() => navigate('/')}>
          <img src="/brand/ccfwp-mark.png" alt="CCFWP" width="32" height="32" className="console-brand-mark" />
          <span className="hidden sm:inline">Workers Console</span>
        </button>
        <nav className="console-nav" aria-label="Primary">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              type="button"
              className={activePath === path ? 'console-nav-item active' : 'console-nav-item'}
              onClick={() => navigate(path)}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-[var(--text-muted)] sm:flex">
            <span className={`h-2 w-2 rounded-full ${serverOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {serverOnline ? t('online') : t('offline')}
          </span>
          <button
            type="button"
            className="console-button primary"
            onClick={() => navigate('/create')}
            aria-label={t('createProject')}
          >
            <Plus size={15} aria-hidden="true" />
            <span className="hidden sm:inline">{t('createProject')}</span>
          </button>
        </div>
      </header>
      <main>{children}</main>
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
        <FeedbackProvider>
          <AppLayout>
            <AppRoutes
              authenticated={authenticated}
              loading={authLoading}
              onAuthenticated={() => setAuthenticated(true)}
            />
          </AppLayout>
        </FeedbackProvider>
      </Router>
    </ThemeProvider>
  );
}

const AppRoutes = ({ authenticated, loading, onAuthenticated }: {
  authenticated: boolean;
  loading: boolean;
  onAuthenticated: () => void;
}) => {
  const { pathname } = useLocation();
  const activePath = routePathname(pathname);
  if (activePath === '/login') return <LoginWrapper onAuthenticated={onAuthenticated} />;

  let page: React.ReactElement;
  if (activePath === '/') page = <Dashboard />;
  else if (activePath === '/deployments') page = <Deployments />;
  else if (activePath === '/resources') page = <Resources />;
  else if (activePath === '/trash') page = <Trash />;
  else if (activePath === '/settings') page = <SettingsPage />;
  else if (activePath === '/create') page = <CreateProject />;
  else return <Navigate to="/" replace />;

  return <ProtectedRoute authenticated={authenticated} loading={loading}>{page}</ProtectedRoute>;
};

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
