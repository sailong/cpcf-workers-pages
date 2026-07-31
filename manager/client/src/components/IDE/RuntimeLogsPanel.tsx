import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import type { Project, ProjectRuntimeMetrics, RuntimeLog } from '../../types';
import { ProjectService } from '../../services';
import { useFeedback } from '../../contexts/feedback-context';
import { getErrorMessage } from '../../utils/errors';

interface RuntimeLogsPanelProps {
    project: Project;
}

type StreamFilter = 'all' | RuntimeLog['stream'];

function formatBytes(value: number | null) {
    if (value === null) return '--';
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && size >= 1024; index += 1) {
        size /= 1024;
        unit = units[index];
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

const RuntimeLogsPanel = ({ project }: RuntimeLogsPanelProps) => {
    const { t } = useTranslation();
    const { notify } = useFeedback();
    const [logs, setLogs] = useState<RuntimeLog[]>([]);
    const [metrics, setMetrics] = useState<ProjectRuntimeMetrics | null>(project.metrics || null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paused, setPaused] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<StreamFilter>('all');
    const [confirmClear, setConfirmClear] = useState(false);
    const [clearing, setClearing] = useState(false);

    const load = useCallback(async (manual = false) => {
        if (manual) setRefreshing(true);
        try {
            const [nextLogs, nextMetrics] = await Promise.all([
                ProjectService.getRuntimeLogs(project.id),
                ProjectService.getMetrics(project.id)
            ]);
            setLogs(nextLogs);
            setMetrics(nextMetrics);
            setError('');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('ide.runtimeLogs.loadFailed')));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [project.id, t]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (paused) return undefined;
        const timer = window.setInterval(() => void load(), 3_000);
        return () => window.clearInterval(timer);
    }, [load, paused]);

    const visibleLogs = useMemo(
        () => filter === 'all' ? logs : logs.filter(log => log.stream === filter),
        [filter, logs]
    );

    const clearLogs = async () => {
        setClearing(true);
        try {
            const result = await ProjectService.clearRuntimeLogs(project.id);
            setLogs([]);
            setConfirmClear(false);
            notify(t('ide.runtimeLogs.clearSuccess', { count: result.removed }), 'success');
        } catch (requestError) {
            notify(getErrorMessage(requestError, t('ide.runtimeLogs.clearFailed')), 'error');
        } finally {
            setClearing(false);
        }
    };

    const metricItems = [
        { label: t('ide.runtimeLogs.cpu'), value: metrics?.cpuPercent == null ? '--' : `${metrics.cpuPercent.toFixed(1)}%` },
        { label: t('ide.runtimeLogs.memory'), value: `${formatBytes(metrics?.memoryBytes ?? null)} / ${formatBytes(metrics?.memoryLimitBytes ?? null)}` },
        { label: t('ide.runtimeLogs.storage'), value: `${formatBytes(metrics?.storageBytes ?? null)} / ${formatBytes(metrics?.storageLimitBytes ?? null)}` },
        { label: t('ide.runtimeLogs.requests'), value: `${metrics?.concurrentRequests ?? '--'} / ${metrics?.concurrencyLimit ?? '--'}` },
        { label: t('ide.runtimeLogs.pids'), value: metrics?.pids ?? '--' }
    ];

    return (
        <section className="flex h-full min-h-0 flex-col bg-[var(--bg-base)]">
            <header className="border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{t('ide.runtimeLogs.title')}</h2>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('ide.runtimeLogs.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="console-button secondary" onClick={() => setPaused(value => !value)}>
                            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
                            {paused ? t('ide.runtimeLogs.resume') : t('ide.runtimeLogs.pause')}
                        </button>
                        <button type="button" className="console-button secondary" onClick={() => void load(true)} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                            {t('ide.runtimeLogs.refresh')}
                        </button>
                        <button type="button" className="console-button danger" onClick={() => setConfirmClear(true)} disabled={!logs.length}>
                            <Trash2 size={14} aria-hidden="true" />
                            {t('ide.runtimeLogs.clear')}
                        </button>
                    </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-[var(--border-color)] bg-[var(--border-color)] sm:grid-cols-5">
                    {metricItems.map(item => (
                        <div key={item.label} className="bg-[var(--bg-base)] px-3 py-2">
                            <dt className="text-[10px] uppercase text-[var(--text-muted)]">{item.label}</dt>
                            <dd className="mt-0.5 font-mono text-xs text-[var(--text-main)]">{item.value}</dd>
                        </div>
                    ))}
                </dl>
            </header>

            <div className="flex items-center gap-1 border-b border-[var(--border-color)] px-4 py-2" role="group" aria-label={t('ide.runtimeLogs.filter')}>
                {(['all', 'stdout', 'stderr', 'system'] as StreamFilter[]).map(stream => (
                    <button
                        key={stream}
                        type="button"
                        className={filter === stream ? 'resource-tab active' : 'resource-tab'}
                        onClick={() => setFilter(stream)}
                    >
                        {t(`ide.runtimeLogs.stream.${stream}`)}
                    </button>
                ))}
                <span className="ml-auto text-xs text-[var(--text-muted)]">{t('ide.runtimeLogs.entries', { count: visibleLogs.length })}</span>
            </div>

            {confirmClear && (
                <div className="flex flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs" role="alert">
                    <span className="text-[var(--text-main)]">{t('ide.runtimeLogs.clearConfirm')}</span>
                    <button type="button" className="console-button danger" disabled={clearing} onClick={() => void clearLogs()}>
                        {clearing ? t('ide.runtimeLogs.clearing') : t('ide.runtimeLogs.confirm')}
                    </button>
                    <button type="button" className="console-button secondary" disabled={clearing} onClick={() => setConfirmClear(false)}>
                        {t('common.cancel')}
                    </button>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto bg-[#101418] font-mono text-xs" aria-live="polite">
                {loading ? (
                    <div className="p-6 text-center text-slate-400">{t('common.loading')}</div>
                ) : error ? (
                    <div className="flex items-center justify-between gap-4 border-b border-red-500/30 bg-red-500/10 p-4 text-red-300">
                        <span>{error}</span>
                        <button type="button" className="console-button secondary" onClick={() => void load(true)}>{t('common.retry')}</button>
                    </div>
                ) : visibleLogs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">{t('ide.runtimeLogs.empty')}</div>
                ) : (
                    <ol className="divide-y divide-white/5">
                        {visibleLogs.map(log => (
                            <li key={log.id} className="grid grid-cols-[9.5rem_4.5rem_minmax(0,1fr)] gap-3 px-4 py-1.5 hover:bg-white/5">
                                <time className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</time>
                                <span className={log.stream === 'stderr' ? 'text-red-400' : log.stream === 'system' ? 'text-amber-300' : 'text-emerald-400'}>
                                    {log.stream}
                                </span>
                                <span className="whitespace-pre-wrap break-words text-slate-200">{log.content}</span>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </section>
    );
};

export default RuntimeLogsPanel;
