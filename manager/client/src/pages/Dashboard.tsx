import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ExternalLink,
    KeyRound,
    Loader2,
    LogOut,
    Play,
    RefreshCw,
    Settings,
    Square,
    Trash2
} from 'lucide-react';
import type { PlatformConfig, Project } from '../types';
import { OperationsService, ProjectService, ResourceService } from '../services';
import IDE from '../components/IDE/IDE';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ThemeToggle from '../components/ThemeToggle';
import { useNavigate } from '../use-router';
import { logout } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { getErrorMessage } from '../utils/errors';
import { projectPublicUrl } from '../utils/project-url';
import { useFeedback } from '../contexts/feedback-context';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { confirm, notify } = useFeedback();
    const [projects, setProjects] = useState<Project[]>([]);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [failedDeployments, setFailedDeployments] = useState(0);
    const [trashExpiringSoon, setTrashExpiringSoon] = useState(0);
    const [sortMode, setSortMode] = useState<'updated' | 'occupancy' | 'failed'>('occupancy');

    const loadProjects = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const [data, currentConfig, deployments, trash] = await Promise.all([
                ProjectService.getAll(),
                ProjectService.getPlatformConfig(),
                OperationsService.getDeployments(100).catch(() => []),
                ResourceService.getTrash().catch(() => [])
            ]);
            setProjects(data);
            setFailedDeployments(deployments.filter(item => item.status === 'failed' || item.status === 'interrupted').length);
            const soon = Date.now() + 3 * 24 * 60 * 60 * 1000;
            setTrashExpiringSoon(trash.filter(item => {
                const purgeAt = item.purgeAfter ? new Date(item.purgeAfter).getTime() : Number.NaN;
                return Number.isFinite(purgeAt) && purgeAt <= soon;
            }).length);
            setEditingProject(current => current
                ? data.find(project => project.id === current.id) || null
                : null);
            setPlatformConfig(currentConfig);
            setLoadError('');
        } catch (error) {
            setLoadError(getErrorMessage(error, t('dashboardPage.loadFailed')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        let cancelled = false;
        let timer: number | undefined;
        const poll = async () => {
            if (!document.hidden) await loadProjects();
            if (!cancelled) timer = window.setTimeout(() => void poll(), 5000);
        };
        void loadProjects(true);
        timer = window.setTimeout(() => void poll(), 5000);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                if (timer !== undefined) window.clearTimeout(timer);
                void poll();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            if (timer !== undefined) window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [loadProjects]);

    const runningCount = useMemo(() => projects.filter(project => project.status === 'running').length, [projects]);

    const toggleProject = async (project: Project) => {
        setPendingId(project.id);
        try {
            if (project.status === 'running') await ProjectService.stop(project.id);
            else await ProjectService.start(project.id);
            notify(project.status === 'running' ? t('dashboardPage.projectStopped') : t('dashboardPage.projectRunning'), 'success');
            await loadProjects();
        } catch (error) {
            notify(`${t('dashboardPage.operationFailed')}: ${getErrorMessage(error, t('dashboardPage.operationFailed'))}`, 'error');
        } finally {
            setPendingId(null);
        }
    };

    const deleteProject = async (project: Project) => {
        const accepted = await confirm({
            title: t('common.confirmDelete'),
            message: t('dashboardPage.confirmDeleteNamed', { name: project.name }),
            confirmLabel: t('common.delete'),
            destructive: true
        });
        if (!accepted) return;

        setPendingId(project.id);
        try {
            await ProjectService.delete(project.id);
            notify(t('dashboardPage.deleteSuccess'), 'success');
            await loadProjects();
        } catch (error) {
            notify(`${t('dashboardPage.deleteError')}: ${getErrorMessage(error, t('dashboardPage.deleteError'))}`, 'error');
        } finally {
            setPendingId(null);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const formatDate = (value: string) => new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));

    const bindingCount = (project: Project) => project.bindings.kv.length + project.bindings.d1.length + project.bindings.r2.length;

    const formatBytes = (value: number | null | undefined) => {
        if (value == null) return '--';
        if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
        if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
        return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
    };


    const usageRatio = (used: number | null | undefined, limit: number | null | undefined) => {
        if (used == null || !limit || limit <= 0) return null;
        return Math.max(0, Math.min(100, (used / limit) * 100));
    };


    const rankedProjects = useMemo(() => {
        const score = (project: Project) => {
            const metrics = project.metrics;
            if (!metrics) return 0;
            const ratios = [
                usageRatio(metrics.cpuPercent, project.limits.cpu * 100) || 0,
                usageRatio(metrics.memoryBytes, metrics.memoryLimitBytes || project.limits.memoryMb * 1024 * 1024) || 0,
                usageRatio(metrics.storageBytes, metrics.storageLimitBytes || project.limits.diskMb * 1024 * 1024) || 0,
                usageRatio(metrics.concurrentRequests, metrics.concurrencyLimit || project.limits.concurrentRequests) || 0
            ];
            return Math.max(...ratios);
        };
        const next = [...projects];
        if (sortMode === 'occupancy') {
            next.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
        } else if (sortMode === 'failed') {
            const rank = (project: Project) => {
                const status = project.lastDeployment?.status;
                if (status === 'failed' || status === 'interrupted') return 2;
                if (status === 'running') return 1;
                return 0;
            };
            next.sort((a, b) => rank(b) - rank(a) || score(b) - score(a) || a.name.localeCompare(b.name));
        } else {
            next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        }
        return next;
    }, [projects, sortMode]);

    const usageBar = (label: string, used: number | null | undefined, limit: number | null | undefined, format: (value: number | null | undefined) => string) => {
        const ratio = usageRatio(used, limit);
        return (
            <div className="min-w-[92px]">
                <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                    <span>{label}</span>
                    <span className="font-mono">{format(used)}{limit ? `/${format(limit)}` : ''}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--bg-subtle)]">
                    <div
                        className={`h-full ${ratio != null && ratio >= 90 ? 'bg-red-500' : ratio != null && ratio >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${ratio ?? 0}%` }}
                    />
                </div>
            </div>
        );
    };

    const projectActions = (project: Project) => {
        const pending = pendingId === project.id;
        const publicUrl = platformConfig ? projectPublicUrl(project, platformConfig) : '';
        return (
            <div className="flex items-center justify-end gap-1">
                <button
                    type="button"
                    className="icon-button"
                    disabled={pending}
                    onClick={() => void toggleProject(project)}
                    title={project.status === 'running' ? t('common.stop') : t('common.start')}
                    aria-label={`${project.status === 'running' ? t('common.stop') : t('common.start')} ${project.name}`}
                >
                    {pending ? <Loader2 size={16} className="animate-spin" /> : project.status === 'running' ? <Square size={15} /> : <Play size={16} />}
                </button>
                <button type="button" className="icon-button" onClick={() => setEditingProject(project)} title={t('common.edit')} aria-label={`${t('common.edit')} ${project.name}`}>
                    <Settings size={16} />
                </button>
                {project.status === 'running' && publicUrl && (
                    <a className="icon-button" href={publicUrl} target="_blank" rel="noreferrer" title={t('common.openApp')} aria-label={`${t('common.openApp')} ${project.name}`}>
                        <ExternalLink size={16} />
                    </a>
                )}
                <button type="button" className="icon-button danger" disabled={pending} onClick={() => void deleteProject(project)} title={t('common.delete')} aria-label={`${t('common.delete')} ${project.name}`}>
                    <Trash2 size={16} />
                </button>
            </div>
        );
    };

    return (
        <div className="console-page">
            <section className="console-page-header">
                <div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>{projects.length} {t('dashboardPage.totalProjects')}</span>
                        <span aria-hidden="true">/</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{runningCount} {t('dashboardPage.running')}</span>
                    </div>
                    <h1>{t('dashboard')}</h1>
                    <p>{t('dashboardSubtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="icon-button" onClick={() => void loadProjects(true)} disabled={loading} title={t('dashboardPage.refresh')} aria-label={t('dashboardPage.refresh')}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <LanguageSwitcher />
                    <ThemeToggle />
                    <button type="button" className="icon-button" onClick={() => setShowChangePassword(true)} title={t('auth.changePasswordTitle')} aria-label={t('auth.changePasswordTitle')}>
                        <KeyRound size={16} />
                    </button>
                    <button type="button" className="icon-button danger" onClick={() => void handleLogout()} title={t('logout')} aria-label={t('logout')}>
                        <LogOut size={16} />
                    </button>
                </div>
            </section>

            {loadError && (
                <div role="alert" className="console-alert error">
                    <span>{loadError}</span>
                    <button type="button" className="console-button secondary" onClick={() => void loadProjects(true)}>{t('dashboardPage.retry')}</button>
                </div>
            )}

            <section className="grid gap-3 md:grid-cols-4" aria-label={t('dashboardPage.opsSummary')}>
                <div className="console-panel p-3">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t('dashboardPage.totalProjects')}</div>
                    <div className="mt-1 text-xl font-semibold">{projects.length}</div>
                </div>
                <div className="console-panel p-3">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t('dashboardPage.running')}</div>
                    <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">{runningCount}</div>
                </div>
                <button type="button" className="console-panel p-3 text-left" onClick={() => navigate(failedDeployments > 0 ? '/deployments?status=failed' : '/deployments')}>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t('dashboardPage.failedDeployments')}</div>
                    <div className={`mt-1 text-xl font-semibold ${failedDeployments > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{failedDeployments}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">{t('dashboardPage.failedDeploymentsHint')}</div>
                </button>
                <button type="button" className="console-panel p-3 text-left" onClick={() => navigate('/trash')}>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t('dashboardPage.trashExpiringSoon')}</div>
                    <div className={`mt-1 text-xl font-semibold ${trashExpiringSoon > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{trashExpiringSoon}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">{t('dashboardPage.trashExpiringSoonHint')}</div>
                </button>
            </section>

            <section className="console-panel" aria-label={t('dashboardPage.projectsTable')}>
                {loading && projects.length === 0 ? (
                    <div className="divide-y divide-[var(--border-color)]" aria-label={t('resourceList.loading')}>
                        {[0, 1, 2, 3].map(row => <div key={row} className="h-16 animate-pulse bg-[var(--bg-subtle)] opacity-60" />)}
                    </div>
                ) : projects.length > 0 ? (
                    <>
                        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] px-4 py-2" aria-label={t('dashboardPage.sortLabel')}>
                            <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{t('dashboardPage.sortLabel')}</span>
                            {([
                                { id: 'occupancy', label: t('dashboardPage.sortOccupancy') },
                                { id: 'failed', label: t('dashboardPage.sortFailed') },
                                { id: 'updated', label: t('dashboardPage.sortUpdated') }
                            ] as const).map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={sortMode === item.id ? 'console-button secondary' : 'console-button ghost'}
                                    onClick={() => setSortMode(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="console-table min-w-[1420px]" aria-label={t('dashboardPage.projectsTable')}>
                                <thead>
                                    <tr>
                                        <th>{t('dashboardPage.columns.project')}</th>
                                        <th>{t('dashboardPage.columns.status')}</th>
                                        <th>{t('dashboardPage.columns.route')}</th>
                                        <th>{t('dashboardPage.columns.release')}</th>
                                        <th>{t('dashboardPage.columns.usage')}</th>
                                        <th>{t('dashboardPage.columns.bindings')}</th>
                                        <th>{t('dashboardPage.columns.lastDeployment')}</th>
                                        <th>{t('dashboardPage.columns.error')}</th>
                                        <th className="text-right">{t('dashboardPage.columns.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankedProjects.map(project => {
                                        const publicUrl = platformConfig ? projectPublicUrl(project, platformConfig) : '';
                                        return (
                                            <tr key={project.id}>
                                                <td>
                                                    <button type="button" onClick={() => setEditingProject(project)} className="text-left">
                                                        <span className="block font-medium text-[var(--text-main)] hover:text-[var(--primary)]">{project.name}</span>
                                                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{project.type.toUpperCase()} / {project.id.slice(0, 8)}</span>
                                                    </button>
                                                </td>
                                                <td><span className={`status-badge ${project.status}`}>{project.status === 'running' ? t('dashboardPage.running') : t('dashboardPage.stopped')}</span></td>
                                                <td className="max-w-[230px] truncate font-mono text-xs" title={publicUrl}>{publicUrl || `:${project.port}`}</td>
                                                <td className="font-mono text-xs">{project.activeReleaseId ? project.activeReleaseId.slice(-10) : t('dashboardPage.none')}</td>
                                                <td className="min-w-[280px]" title={t('dashboardPage.usageHint')}>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {usageBar('CPU', project.metrics?.cpuPercent, project.limits.cpu * 100, value => value == null ? '--' : `${value.toFixed(0)}%`)}
                                                        {usageBar('MEM', project.metrics?.memoryBytes, project.metrics?.memoryLimitBytes || project.limits.memoryMb * 1024 * 1024, formatBytes)}
                                                        {usageBar('DISK', project.metrics?.storageBytes, project.metrics?.storageLimitBytes || project.limits.diskMb * 1024 * 1024, formatBytes)}
                                                        {usageBar('CONC', project.metrics?.concurrentRequests, project.metrics?.concurrencyLimit || project.limits.concurrentRequests, value => value == null ? '--' : String(value))}
                                                    </div>
                                                </td>
                                                <td>{bindingCount(project)}</td>
                                                <td className="whitespace-nowrap text-xs">
                                                    {project.lastDeployment ? <><span className={`status-badge ${project.lastDeployment.status === 'succeeded' ? 'running' : project.lastDeployment.status === 'running' ? 'pending' : 'stopped'}`}>{t(`ide.operations.status.${project.lastDeployment.status}`)}</span><span className="mt-1 block text-[11px] text-[var(--text-muted)]">{formatDate(project.lastDeployment.startedAt)}</span></> : t('dashboardPage.none')}
                                                </td>
                                                <td className="max-w-[230px] truncate text-xs text-red-600 dark:text-red-400" title={String(project.lastDeployment?.result?.error || '')}>{String(project.lastDeployment?.result?.error || '--')}</td>
                                                <td>{projectActions(project)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-[var(--border-color)] lg:hidden">
                            {rankedProjects.map(project => {
                                const publicUrl = platformConfig ? projectPublicUrl(project, platformConfig) : '';
                                return (
                                    <article key={project.id} className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h2 className="truncate text-sm font-semibold">{project.name}</h2>
                                                    <span className={`status-badge ${project.status}`}>{project.status === 'running' ? t('dashboardPage.running') : t('dashboardPage.stopped')}</span>
                                                </div>
                                                <p className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">{publicUrl || `:${project.port}`}</p>
                                            </div>
                                            {projectActions(project)}
                                        </div>
                                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                            <div><dt className="text-[var(--text-muted)]">{t('dashboardPage.columns.release')}</dt><dd className="mt-0.5 font-mono">{project.activeReleaseId?.slice(-10) || t('dashboardPage.none')}</dd></div>
                                            <div><dt className="text-[var(--text-muted)]">{t('dashboardPage.columns.bindings')}</dt><dd className="mt-0.5">{bindingCount(project)}</dd></div>
                                            <div className="col-span-2"><dt className="text-[var(--text-muted)]">{t('dashboardPage.columns.usage')}</dt><dd className="mt-1 grid grid-cols-2 gap-2">{usageBar('CPU', project.metrics?.cpuPercent, project.limits.cpu * 100, value => value == null ? '--' : `${value.toFixed(0)}%`)}{usageBar('MEM', project.metrics?.memoryBytes, project.metrics?.memoryLimitBytes || project.limits.memoryMb * 1024 * 1024, formatBytes)}{usageBar('DISK', project.metrics?.storageBytes, project.metrics?.storageLimitBytes || project.limits.diskMb * 1024 * 1024, formatBytes)}{usageBar('CONC', project.metrics?.concurrentRequests, project.metrics?.concurrencyLimit || project.limits.concurrentRequests, value => value == null ? '--' : String(value))}</dd></div>
                                            <div className="col-span-2"><dt className="text-[var(--text-muted)]">{t('dashboardPage.columns.lastDeployment')}</dt><dd className="mt-0.5">{project.lastDeployment ? `${t(`ide.operations.status.${project.lastDeployment.status}`)} / ${formatDate(project.lastDeployment.startedAt)}` : t('dashboardPage.none')}</dd></div>
                                        </dl>
                                    </article>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                        <h2 className="text-base font-semibold">{t('dashboardPage.noProjects')}</h2>
                        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">{t('dashboardPage.noProjectsSubtitle')}</p>
                        <button type="button" onClick={() => navigate('/create')} className="console-button primary mt-5">{t('createProject')}</button>
                    </div>
                )}
            </section>

            {editingProject && (
                <IDE project={editingProject} onClose={() => setEditingProject(null)} onSaved={() => void loadProjects()} />
            )}

            {showChangePassword && (
                <ChangePasswordModal onClose={() => setShowChangePassword(false)} onSuccess={() => setShowChangePassword(false)} />
            )}
        </div>
    );
};

export default Dashboard;
