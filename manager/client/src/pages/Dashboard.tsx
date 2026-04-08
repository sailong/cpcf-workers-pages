import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../types';
import { ProjectService } from '../services';
import IDE from '../components/IDE/IDE';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ThemeToggle from '../components/ThemeToggle';
import { useNavigate } from 'react-router-dom';
import { removeToken } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [projects, setProjects] = useState<Project[]>([]);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [rootDomain, setRootDomain] = useState<string>(window.location.hostname);

    useEffect(() => {
        loadProjects();
        const interval = setInterval(loadProjects, 5000);
        
        // 页面可见性检测 - 不可见时停止轮询
        const handleVisibilityChange = () => {
            if (document.hidden) {
                clearInterval(interval);
            } else {
                loadProjects(); // 重新可见时立即刷新
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const loadProjects = async () => {
        try {
            const data = await ProjectService.getAll();
            setProjects(data);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleProject = async (p: Project) => {
        try {
            if (p.status === 'running') {
                await ProjectService.stop(p.id);
            } else {
                try {
                    await ProjectService.start(p.id);
                } catch (e: any) {
                    // Handle Port In Use (409)
                    if (e.response && e.response.status === 409) {
                        const confirmForce = window.confirm(
                            t('dashboardPage.forceStart', { port: p.port })
                        );
                        if (confirmForce) {
                            await ProjectService.start(p.id, true);
                        } else {
                            return;
                        }
                    } else {
                        throw e;
                    }
                }
            }
            loadProjects();
        } catch (e: any) {
            console.error(e);
            alert(t('dashboardPage.operationFailed') + ': ' + (e.response?.data?.error || e.message));
        }
    };

    const deleteProject = async (id: string) => {
        if (!confirm(t('dashboardPage.confirmDelete'))) return;
        try {
            await ProjectService.delete(id);
            loadProjects();
        } catch (e: any) {
            alert(t('dashboardPage.deleteError') + ': ' + (e.response?.data?.error || e.message));
        }
    };

    const handleLogout = () => {
        removeToken();
        navigate('/login');
    };

    return (
        <div className="max-w-7xl mx-auto p-6 md:p-10 animate-in fade-in zoom-in duration-500">
            {/* Header Area */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tight">{t('dashboard')}</h1>
                    <p className="text-[var(--text-muted)] mt-1 font-medium">{t('dashboardSubtitle')}</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/resources')}
                        className="btn-glass min-w-[150px] justify-center"
                    >
                        <span>{t('dashboardPage.viewResources')}</span>
                    </button>

                    <a
                        href="/create"
                        className="btn-gradient flex items-center gap-2 min-w-[150px] justify-center"
                    >
                        <span>{t('dashboardPage.newProject')}</span>
                    </a>

                    <div className="h-8 w-px bg-current opacity-10 mx-2"></div>

                    <div className="flex items-center gap-2 bg-white/10 p-1 rounded-2xl border border-white/20 backdrop-blur-md">
                        <LanguageSwitcher />
                        <ThemeToggle />
                        <button onClick={() => setShowChangePassword(true)} className="p-2 rounded-xl hover:bg-white/20 transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
                            🔑
                        </button>
                        <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-red-500/20 hover:text-red-500 transition-all text-[var(--text-muted)]" title={t('logout')}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats / Overview - Optional Bento Item */}
            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="neo-card p-6">
                    <span className="text-sm text-[var(--text-muted)] uppercase tracking-wider font-bold">Total Projects</span>
                    <span className="text-4xl font-black mt-2">{projects.length}</span>
                </div>
            </div> */}

            {/* Projects Grid - Bento Style */}
            {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(p => (
                        <div key={p.id} className="neo-card p-6 h-56 justify-between group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide border ${p.type === 'worker'
                                        ? 'border-orange-500/30 text-orange-500 bg-orange-500/10'
                                        : 'border-blue-500/30 text-blue-500 bg-blue-500/10'
                                        }`}>
                                        {p.type}
                                    </span>
                                    <h3 className="text-2xl font-bold mt-3 text-[var(--text-main)] truncate pr-4">{p.name}</h3>
                                    <div className="text-xs text-[var(--text-muted)] font-mono mt-1 opacity-60">
                                        :{p.port} • {p.id.substring(0, 8)}
                                    </div>
                                </div>

                                <div className={`w-3 h-3 rounded-full shadow-lg transition-all duration-500 ${p.status === 'running'
                                    ? 'bg-emerald-500 shadow-emerald-500/50 scale-100'
                                    : 'bg-[var(--text-muted)]/30 scale-75'
                                    }`} />
                            </div>

                            {/* Action Bar - Reveals on Hover (or always visible in cleaner way) */}
                            <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[var(--glass-border)] opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => toggleProject(p)}
                                    className={`px-4 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${p.status === 'running'
                                        ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                        }`}
                                >
                                    {p.status === 'running' ? t('common.stop') : t('common.start')}
                                </button>

                                <button onClick={() => setEditingProject(p)} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors text-[var(--text-muted)]">
                                    ⚙️
                                </button>

                                <button onClick={() => deleteProject(p.id)} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                                    🗑
                                </button>

                                {p.status === 'running' && (
                                    <a
                                        href={`${window.location.protocol}//${p.name}-${p.type}.${rootDomain || 'localhost'}${window.location.port ? ':' + window.location.port : ''}`}
                                        target="_blank"
                                        className="ml-auto h-9 w-9 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                                        title={t('common.openApp')}
                                    >
                                        ↗
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="neo-glass p-20 flex flex-col items-center justify-center text-center relative">
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-2xl mb-6 blur-md opacity-20 animate-pulse"></div>
                    <div className="relative w-24 h-24 flex items-center justify-center text-5xl -mt-24 mb-6">🚀</div>
                    <h3 className="text-2xl font-bold text-[var(--text-main)]">{t('dashboardPage.noProjects')}</h3>
                    <p className="text-[var(--text-muted)] mt-2 mb-8 max-w-md">{t('dashboardPage.noProjectsSubtitle')}</p>
                    <a href="/create" className="btn-gradient">{t('createProject')}</a>
                </div>
            )}

            {editingProject && (
                <IDE
                    project={editingProject}
                    onClose={() => setEditingProject(null)}
                    onSaved={() => {
                        loadProjects();
                    }}
                />
            )}

            {showChangePassword && (
                <ChangePasswordModal onClose={() => setShowChangePassword(false)} onSuccess={() => setShowChangePassword(false)} />
            )}
        </div>
    );
};

export default Dashboard;
