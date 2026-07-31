import { useLocation, useNavigate } from '../use-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import type { AuditEvent, ProjectDeployment } from '../types';
import { OperationsService } from '../services';
import { getErrorMessage } from '../utils/errors';

type View = 'deployments' | 'audit';

const Deployments = () => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const statusFilter = useMemo(() => {
        try {
            const search = location.pathname.includes('?')
                ? location.pathname.slice(location.pathname.indexOf('?'))
                : window.location.search;
            return new URLSearchParams(search).get('status') || '';
        } catch {
            return '';
        }
    }, [location.pathname]);
    const [view, setView] = useState<View>('deployments');
    const [deployments, setDeployments] = useState<ProjectDeployment[]>([]);
    const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [loadedAt, setLoadedAt] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [nextDeployments, nextAudit] = await Promise.all([
                OperationsService.getDeployments(),
                OperationsService.getAuditEvents()
            ]);
            setDeployments(nextDeployments);
            setAuditEvents(nextAudit);
            setLoadedAt(Date.now());
            setError('');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('deploymentsPage.loadFailed')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { void load(); }, [load]);

    const runningCount = useMemo(() => deployments.filter(item => item.status === 'running').length, [deployments]);
    const visibleDeployments = useMemo(() => {
        if (statusFilter === 'failed') {
            return deployments.filter(item => item.status === 'failed' || item.status === 'interrupted');
        }
        if (statusFilter === 'running') return deployments.filter(item => item.status === 'running');
        if (statusFilter === 'succeeded') return deployments.filter(item => item.status === 'succeeded');
        return deployments;
    }, [deployments, statusFilter]);
    const failureReasons = useMemo(() => {
        const counts = new Map<string, number>();
        for (const item of deployments) {
            if (item.status !== 'failed' && item.status !== 'interrupted') continue;
            const reason = String(item.result?.error || '').trim() || t('deploymentsPage.unknownError');
            counts.set(reason, (counts.get(reason) || 0) + 1);
        }
        return [...counts.entries()]
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
            .slice(0, 5);
    }, [deployments, t]);
    const formatDate = (value: string | null | undefined) => value
        ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
        : '--';
    const duration = (deployment: ProjectDeployment) => {
        const end = deployment.completedAt ? Date.parse(deployment.completedAt) : loadedAt;
        const seconds = Math.max(0, Math.round((end - Date.parse(deployment.startedAt)) / 1000));
        return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    };

    return (
        <div className="console-page">
            <section className="console-page-header">
                <div>
                    <div className="text-xs text-[var(--text-muted)]">{t('deploymentsPage.summary', { count: deployments.length, running: runningCount })}</div>
                    <h1>{t('deployments')}</h1>
                    <p>{t('deploymentsPage.subtitle')}</p>
                </div>
                <button type="button" className="console-button secondary" onClick={() => void load()} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                    {t('common.refresh')}
                </button>
            </section>

            <div className="mb-4 flex gap-1 border-b border-[var(--border-color)]" role="tablist">
                {(['deployments', 'audit'] as View[]).map(item => (
                    <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? 'resource-tab active' : 'resource-tab'} onClick={() => setView(item)}>
                        {t(`deploymentsPage.tabs.${item}`)}
                    </button>
                ))}
            </div>

            {view === 'deployments' && (
                <div className="mb-3 flex flex-wrap gap-2" aria-label={t('deploymentsPage.filters')}>
                    {[
                        { id: '', label: t('deploymentsPage.filterAll') },
                        { id: 'failed', label: t('deploymentsPage.filterFailed') },
                        { id: 'running', label: t('deploymentsPage.filterRunning') },
                        { id: 'succeeded', label: t('deploymentsPage.filterSucceeded') }
                    ].map(item => (
                        <button
                            key={item.id || 'all'}
                            type="button"
                            className={statusFilter === item.id ? 'console-button secondary' : 'console-button ghost'}
                            onClick={() => navigate(item.id ? `/deployments?status=${item.id}` : '/deployments')}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            {view === 'deployments' && failureReasons.length > 0 && (
                <section className="console-panel mb-3 p-3" aria-label={t('deploymentsPage.topFailureReasons')}>
                    <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">{t('deploymentsPage.topFailureReasons')}</div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {failureReasons.map(item => (
                            <button
                                key={item.reason}
                                type="button"
                                className="rounded border border-[var(--border-color)] bg-[var(--bg-subtle)] px-3 py-2 text-left hover:bg-[var(--bg-hover)]"
                                onClick={() => navigate('/deployments?status=failed')}
                                title={item.reason}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-mono text-xs font-semibold">{item.count}</span>
                                    <span className="truncate text-xs text-[var(--text-muted)]">{item.reason}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {error && <div className="console-alert error" role="alert"><span>{error}</span><button type="button" className="console-button secondary" onClick={() => void load()}>{t('common.retry')}</button></div>}

            <section className="console-panel overflow-x-auto">
                {loading && !deployments.length && !auditEvents.length ? (
                    <div className="p-8 text-center text-sm text-[var(--text-muted)]">{t('common.loading')}</div>
                ) : view === 'deployments' ? (
                    visibleDeployments.length ? <table className="console-table min-w-[900px]">
                        <thead><tr><th>{t('deploymentsPage.project')}</th><th>{t('deploymentsPage.kind')}</th><th>{t('deploymentsPage.status')}</th><th>{t('deploymentsPage.started')}</th><th>{t('deploymentsPage.duration')}</th><th>{t('deploymentsPage.result')}</th></tr></thead>
                        <tbody>{visibleDeployments.map(item => <tr key={item.id}>
                            <td><span className="block font-medium">{item.projectName || item.projectId}</span><span className="font-mono text-[11px] text-[var(--text-muted)]">{item.projectType?.toUpperCase()} / {item.projectId.slice(0, 8)}</span></td>
                            <td>{t(`ide.operations.kind.${item.kind}`, { defaultValue: item.kind })}</td>
                            <td><span className={`status-badge ${item.status === 'succeeded' ? 'running' : item.status === 'running' ? 'pending' : 'stopped'}`}>{t(`ide.operations.status.${item.status}`)}</span></td>
                            <td className="whitespace-nowrap text-xs">{formatDate(item.startedAt)}</td>
                            <td className="font-mono text-xs">{duration(item)}</td>
                            <td className="max-w-[320px] truncate text-xs text-[var(--text-muted)]" title={String(item.result?.error || '')}>{String(item.result?.error || t('deploymentsPage.noError'))}</td>
                        </tr>)}</tbody>
                    </table> : <div className="p-8 text-center text-sm text-[var(--text-muted)]">{t('deploymentsPage.empty')}</div>
                ) : (
                    auditEvents.length ? <table className="console-table min-w-[840px]">
                        <thead><tr><th>{t('deploymentsPage.time')}</th><th>{t('deploymentsPage.action')}</th><th>{t('deploymentsPage.entity')}</th><th>{t('deploymentsPage.details')}</th></tr></thead>
                        <tbody>{auditEvents.map(event => <tr key={event.id}>
                            <td className="whitespace-nowrap text-xs">{formatDate(event.createdAt)}</td>
                            <td className="font-mono text-xs">{event.action}</td>
                            <td><span className="block">{event.entityType}</span><span className="font-mono text-[11px] text-[var(--text-muted)]">{event.entityId || '--'}</span></td>
                            <td className="max-w-[460px] truncate font-mono text-xs text-[var(--text-muted)]" title={JSON.stringify(event.details)}>{JSON.stringify(event.details)}</td>
                        </tr>)}</tbody>
                    </table> : <div className="p-8 text-center text-sm text-[var(--text-muted)]">{t('deploymentsPage.auditEmpty')}</div>
                )}
            </section>
        </div>
    );
};

export default Deployments;
