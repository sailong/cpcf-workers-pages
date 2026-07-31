import { useTranslation } from 'react-i18next';
import type { Project } from '../../types';

interface OverviewPanelProps {
    project: Project;
}

function formatBytes(megabytes: number) {
    return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${megabytes} MB`;
}

const OverviewPanel = ({ project }: OverviewPanelProps) => {
    const { t } = useTranslation();
    const bindingCount = project.bindings.kv.length + project.bindings.d1.length + project.bindings.r2.length;
    const items = [
        [t('ide.overview.status'), project.status === 'running' ? t('dashboardPage.running') : t('dashboardPage.stopped')],
        [t('ide.overview.type'), project.type === 'worker' ? 'Worker' : 'Pages'],
        [t('ide.overview.release'), project.activeReleaseId?.slice(-16) || t('dashboardPage.none')],
        [t('ide.overview.port'), String(project.port)],
        [t('ide.overview.bindings'), String(bindingCount)],
        [t('ide.overview.compatibility'), project.compatibilityDate]
    ];
    const limits = [
        [t('ide.runtimeLogs.cpu'), `${project.limits.cpu} CPU`],
        [t('ide.runtimeLogs.memory'), formatBytes(project.limits.memoryMb)],
        [t('ide.runtimeLogs.storage'), formatBytes(project.limits.diskMb)],
        [t('ide.config.limits.upload'), formatBytes(project.limits.uploadMb)],
        [t('ide.runtimeLogs.requests'), String(project.limits.concurrentRequests)],
        [t('ide.config.limits.buildTimeout'), `${project.limits.buildTimeoutSeconds}s`],
        [t('ide.runtimeLogs.pids'), String(project.limits.pids)]
    ];

    return (
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
            <section className="mb-6">
                <h2 className="text-sm font-semibold text-[var(--text-main)]">{t('ide.overview.title')}</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{t('ide.overview.subtitle')}</p>
                <dl className="mt-4 grid border-l border-t border-[var(--border-color)] sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(([label, value]) => <div key={label} className="border-b border-r border-[var(--border-color)] px-4 py-3"><dt className="text-xs text-[var(--text-muted)]">{label}</dt><dd className="mt-1 truncate font-mono text-sm text-[var(--text-main)]" title={value}>{value}</dd></div>)}
                </dl>
            </section>
            <section>
                <h2 className="text-sm font-semibold text-[var(--text-main)]">{t('ide.overview.limits')}</h2>
                <dl className="mt-3 grid border-l border-t border-[var(--border-color)] grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
                    {limits.map(([label, value]) => <div key={label} className="border-b border-r border-[var(--border-color)] px-3 py-2"><dt className="text-[10px] text-[var(--text-muted)]">{label}</dt><dd className="mt-1 font-mono text-xs text-[var(--text-main)]">{value}</dd></div>)}
                </dl>
            </section>
        </div>
    );
};

export default OverviewPanel;
