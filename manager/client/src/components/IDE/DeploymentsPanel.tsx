import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project, ProjectDeployment } from '../../types';
import { ProjectService } from '../../services';
import { getErrorMessage } from '../../utils/errors';

const StatusIcon = ({ status }: { status: ProjectDeployment['status'] }) => {
    if (status === 'running') return <Loader2 size={15} className="animate-spin text-blue-500" />;
    if (status === 'succeeded') return <CheckCircle2 size={15} className="text-emerald-500" />;
    if (status === 'failed') return <AlertCircle size={15} className="text-red-500" />;
    return <Clock3 size={15} className="text-amber-500" />;
};

const DeploymentsPanel = ({ project }: { project: Project }) => {
    const { t, i18n } = useTranslation();
    const [deployments, setDeployments] = useState<ProjectDeployment[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const data = await ProjectService.getDeployments(project.id);
            setDeployments(data);
            setSelectedId(current => current && data.some(item => item.id === current) ? current : data[0]?.id || null);
            setError('');
        } catch (loadError) {
            setError(getErrorMessage(loadError, t('ide.operations.loadFailed')));
        } finally {
            setLoading(false);
        }
    }, [project.id, t]);

    useEffect(() => {
        void load();
        const timer = window.setInterval(() => {
            if (!document.hidden) void load();
        }, 3000);
        return () => window.clearInterval(timer);
    }, [load]);

    const selected = deployments.find(item => item.id === selectedId) || null;
    const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium', timeStyle: 'medium'
    }).format(new Date(value)) : '-';

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--bg-base)]" data-testid="project-operations-panel">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold">{t('ide.operations.title')}</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('ide.operations.subtitle')}</p>
                </div>
                <button type="button" className="icon-button" onClick={() => void load()} disabled={loading} title={t('ide.operations.refresh')} aria-label={t('ide.operations.refresh')}>
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && <div role="alert" className="console-alert error m-4">{error}</div>}

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <div className="w-full shrink-0 overflow-y-auto border-b border-[var(--border-color)] bg-[var(--bg-card)] md:w-80 md:border-b-0 md:border-r">
                    {deployments.map(deployment => (
                        <button
                            key={deployment.id}
                            type="button"
                            onClick={() => setSelectedId(deployment.id)}
                            className={`flex w-full items-start gap-3 border-b border-[var(--border-color)] px-4 py-3 text-left transition-colors ${selectedId === deployment.id ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-subtle)]'}`}
                        >
                            <StatusIcon status={deployment.status} />
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                                    <span>{t(`ide.operations.kind.${deployment.kind}`)}</span>
                                    <span className="text-[11px] font-normal text-[var(--text-muted)]">{t(`ide.operations.status.${deployment.status}`)}</span>
                                </span>
                                <span className="mt-1 block truncate font-mono text-[11px] text-[var(--text-muted)]">{deployment.id.slice(-16)}</span>
                                <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{formatDate(deployment.startedAt)}</span>
                            </span>
                        </button>
                    ))}
                    {!loading && deployments.length === 0 && <p className="p-8 text-center text-sm text-[var(--text-muted)]">{t('ide.operations.empty')}</p>}
                </div>

                <div className="min-h-0 flex-1 overflow-auto bg-[#0c1015] p-4 font-mono text-xs text-slate-300">
                    {selected ? (
                        <>
                            <div className="mb-4 grid grid-cols-1 gap-2 border-b border-slate-700 pb-4 text-[11px] text-slate-400 sm:grid-cols-2">
                                <span>{t('ide.operations.started')}: {formatDate(selected.startedAt)}</span>
                                <span>{t('ide.operations.completed')}: {formatDate(selected.completedAt)}</span>
                            </div>
                            <div className="space-y-1" aria-label={t('ide.operations.logs')}>
                                {selected.logs.map((log, index) => (
                                    <div key={`${log.timestamp}-${index}`} className={log.level === 'error' ? 'text-red-400' : ''}>
                                        <span className="mr-3 text-slate-600">{new Date(log.timestamp).toLocaleTimeString(i18n.language)}</span>
                                        <span className="whitespace-pre-wrap break-words">{log.content}</span>
                                    </div>
                                ))}
                                {selected.logs.length === 0 && <p className="text-slate-500">{t('ide.operations.noLogs')}</p>}
                            </div>
                        </>
                    ) : (
                        <div className="flex h-full items-center justify-center text-slate-500">{loading ? <Loader2 size={20} className="animate-spin" /> : t('ide.operations.select')}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeploymentsPanel;
