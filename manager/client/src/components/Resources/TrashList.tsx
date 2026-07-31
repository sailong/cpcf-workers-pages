import React, { useCallback, useEffect, useState } from 'react';
import { Database, HardDrive, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TrashedResource } from '../../types';
import { ResourceService } from '../../services';
import { getErrorMessage } from '../../utils/errors';
import { useFeedback } from '../../contexts/feedback-context';

const ResourceIcon = ({ kind }: { kind: TrashedResource['kind'] }) => {
    if (kind === 'd1') return <Database size={17} />;
    if (kind === 'r2') return <HardDrive size={17} />;
    return <span className="font-mono text-xs font-bold">KV</span>;
};

const TrashList: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { confirm, notify } = useFeedback();
    const [resources, setResources] = useState<TrashedResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingId, setPendingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setResources(await ResourceService.getTrash());
            setError('');
        } catch (loadError) {
            setError(getErrorMessage(loadError, t('trash.loadFailed')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { void load(); }, [load]);

    const restore = async (resource: TrashedResource) => {
        setPendingId(resource.id);
        try {
            await ResourceService.restoreTrash(resource.id);
            notify(t('trash.restoreSuccess'), 'success');
            await load();
        } catch (restoreError) {
            notify(getErrorMessage(restoreError, t('trash.restoreFailed')), 'error');
        } finally {
            setPendingId(null);
        }
    };

    const purge = async (resource: TrashedResource) => {
        const accepted = await confirm({
            title: t('trash.purgeTitle'),
            message: t('trash.purgeConfirm', { name: resource.name }),
            confirmLabel: t('trash.purge'),
            destructive: true
        });
        if (!accepted) return;
        setPendingId(resource.id);
        try {
            await ResourceService.purgeTrash(resource.id);
            notify(t('trash.purgeSuccess'), 'success');
            await load();
        } catch (purgeError) {
            notify(getErrorMessage(purgeError, t('trash.purgeFailed')), 'error');
        } finally {
            setPendingId(null);
        }
    };

    const formatDate = (value: string) => new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium', timeStyle: 'short'
    }).format(new Date(value));

    const [nowMs] = useState(() => Date.now());
    const remainingDays = (value: string) => {
        const ms = new Date(value).getTime() - nowMs;
        return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    };

    return (
        <section className="console-panel">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold">{t('trash.title')}</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('trash.subtitle')}</p>
                </div>
                <button type="button" className="icon-button" onClick={() => void load()} disabled={loading} title={t('trash.refresh')} aria-label={t('trash.refresh')}>
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && <div role="alert" className="console-alert error m-4">{error}</div>}

            {loading && resources.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center text-[var(--text-muted)]"><Loader2 size={20} className="animate-spin" /></div>
            ) : resources.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                    <Trash2 size={22} className="text-[var(--text-muted)]" />
                    <p className="mt-3 text-sm font-medium">{t('trash.empty')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="console-table min-w-[860px]">
                        <thead><tr>
                            <th>{t('trash.resource')}</th>
                            <th>{t('trash.type')}</th>
                            <th>{t('trash.deletedAt')}</th>
                            <th>{t('trash.purgeAfter')}</th>
                            <th>{t('trash.remaining')}</th>
                            <th className="text-right">{t('dashboardPage.columns.actions')}</th>
                        </tr></thead>
                        <tbody>
                            {resources.map(resource => (
                                <tr key={resource.id}>
                                    <td><span className="font-medium">{resource.name}</span><span className="mt-0.5 block font-mono text-[11px] text-[var(--text-muted)]">{resource.id}</span></td>
                                    <td><span className="flex items-center gap-2 uppercase"><ResourceIcon kind={resource.kind} /> {resource.kind}</span></td>
                                    <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{formatDate(resource.deletedAt)}</td>
                                    <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{formatDate(resource.purgeAfter)}</td>
                                    <td className={`whitespace-nowrap text-xs font-medium ${remainingDays(resource.purgeAfter) <= 3 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{remainingDays(resource.purgeAfter)} {t('trash.daysLeft')}</td>
                                    <td>
                                        <div className="flex justify-end gap-1">
                                            <button type="button" className="icon-button" disabled={pendingId === resource.id} onClick={() => void restore(resource)} title={t('trash.restore')} aria-label={`${t('trash.restore')} ${resource.name}`}>
                                                {pendingId === resource.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                            </button>
                                            <button type="button" className="icon-button danger" disabled={pendingId === resource.id} onClick={() => void purge(resource)} title={t('trash.purge')} aria-label={`${t('trash.purge')} ${resource.name}`}><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default TrashList;
