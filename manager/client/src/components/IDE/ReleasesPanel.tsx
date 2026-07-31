import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project, ProjectRelease } from '../../types';
import { ProjectService } from '../../services';
import { getErrorMessage } from '../../utils/errors';
import { useFeedback } from '../../contexts/feedback-context';

interface ReleasesPanelProps {
    project: Project;
    onChanged: () => void;
}

const ReleasesPanel: React.FC<ReleasesPanelProps> = ({ project, onChanged }) => {
    const { t, i18n } = useTranslation();
    const { confirm, notify } = useFeedback();
    const [releases, setReleases] = useState<ProjectRelease[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setReleases(await ProjectService.getReleases(project.id));
        } catch (err) {
            setError(getErrorMessage(err, t('ide.releases.loadFailed')));
        } finally {
            setLoading(false);
        }
    }, [project.id, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const runChange = async (releaseId?: string) => {
        const confirmation = releaseId
            ? t('ide.releases.confirmActivate')
            : t('ide.releases.confirmRollback');
        if (!await confirm({
            title: releaseId ? t('ide.releases.activate') : t('ide.releases.rollback'),
            message: confirmation,
            confirmLabel: releaseId ? t('ide.releases.activate') : t('ide.releases.rollback')
        })) return;

        setPendingId(releaseId || 'rollback');
        setError('');
        try {
            if (releaseId) await ProjectService.activateRelease(project.id, releaseId);
            else await ProjectService.rollback(project.id);
            await load();
            onChanged();
            notify(t('ide.releases.changeSuccess'), 'success');
        } catch (err) {
            setError(getErrorMessage(err, t('ide.releases.changeFailed')));
        } finally {
            setPendingId(null);
        }
    };

    const formatDate = (value: string) => new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'medium'
    }).format(new Date(value));

    const activeIndex = releases.findIndex(release => release.active);
    const canRollback = activeIndex >= 0 && releases.length > 1;

    return (
        <div className="min-h-full bg-[var(--bg-base)] text-[var(--text-main)]">
            <div className="border-b border-[var(--border-color)] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">{t('ide.releases.title')}</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        {t('ide.releases.summary', { count: releases.length })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void load()}
                        disabled={loading || pendingId !== null}
                        className="px-3 py-1.5 text-xs border border-[var(--border-color)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                    >
                        {t('ide.releases.refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => void runChange()}
                        disabled={!canRollback || pendingId !== null}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {pendingId === 'rollback' ? t('ide.releases.switching') : t('ide.releases.rollback')}
                    </button>
                </div>
            </div>

            {error && (
                <div role="alert" className="mx-6 mt-4 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm" aria-label={t('ide.releases.title')}>
                    <thead className="bg-[var(--bg-card)] text-[var(--text-muted)] text-xs">
                        <tr className="border-b border-[var(--border-color)]">
                            <th className="text-left font-medium px-6 py-2.5">{t('ide.releases.status')}</th>
                            <th className="text-left font-medium px-4 py-2.5">{t('ide.releases.version')}</th>
                            <th className="text-left font-medium px-4 py-2.5">{t('ide.releases.checksum')}</th>
                            <th className="text-left font-medium px-4 py-2.5">{t('ide.releases.created')}</th>
                            <th className="text-right font-medium px-6 py-2.5">{t('ide.releases.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {releases.map(release => (
                            <tr key={release.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)]">
                                <td className="px-6 py-3">
                                    <span className={release.active
                                        ? 'text-green-600 dark:text-green-400 font-medium'
                                        : 'text-[var(--text-muted)]'}>
                                        {release.active ? t('ide.releases.active') : t('ide.releases.inactive')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs" title={release.id}>{release.id.slice(-12)}</td>
                                <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]" title={release.checksum}>
                                    {release.checksum.slice(0, 12)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--text-muted)]">{formatDate(release.createdAt)}</td>
                                <td className="px-6 py-3 text-right">
                                    <button
                                        type="button"
                                        onClick={() => void runChange(release.id)}
                                        disabled={release.active || pendingId !== null}
                                        className="px-3 py-1.5 text-xs border border-[var(--border-color)] hover:bg-[var(--bg-card)] disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {pendingId === release.id ? t('ide.releases.switching') : t('ide.releases.activate')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {!loading && releases.length === 0 && (
                <div className="p-10 text-center text-sm text-[var(--text-muted)]">{t('ide.releases.empty')}</div>
            )}
            {loading && (
                <div className="p-10 text-center text-sm text-[var(--text-muted)]">{t('ide.releases.loading')}</div>
            )}
        </div>
    );
};

export default ReleasesPanel;
