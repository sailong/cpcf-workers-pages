import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, PackageCheck, RefreshCw, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import type { SystemStatus } from '../types';
import { SystemService } from '../services';
import { useFeedback } from '../contexts/feedback-context';
import { getErrorMessage } from '../utils/errors';
import { getSystemWarningTranslationKey } from '../utils/system-warnings';

const Settings = () => {
    const { t } = useTranslation();
    const { confirm, notify } = useFeedback();
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [releaseVersion, setReleaseVersion] = useState('');
    const [releaseAction, setReleaseAction] = useState<'check' | 'upgrade' | 'rollback' | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setStatus(await SystemService.getStatus());
            setError('');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('settingsPage.loadFailed')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const operation = status?.application?.operation;
        if (!operation || !['queued', 'running'].includes(operation.status)) return;
        const timer = window.setInterval(async () => {
            try {
                const application = await SystemService.getUpgradeStatus();
                setStatus(current => current ? { ...current, application } : current);
            } catch { /* The manager may be restarting; the next poll will retry. */ }
        }, 2000);
        return () => window.clearInterval(timer);
    }, [status?.application?.operation]);

    const confirmDomains = async () => {
        if (!status) return;
        setConfirming(true);
        try {
            await SystemService.confirmDomains(status.configuration.consoleHost, status.configuration.projectsBaseDomain);
            notify(t('settingsPage.confirmSuccess'), 'success');
            await load();
        } catch (requestError) {
            notify(getErrorMessage(requestError, t('settingsPage.confirmFailed')), 'error');
        } finally {
            setConfirming(false);
        }
    };

    const checkRelease = async () => {
        setReleaseAction('check');
        try {
            const application = await SystemService.checkUpgrade(releaseVersion.trim() || undefined);
            setStatus(current => current ? { ...current, application } : current);
            if (application.candidate?.version) setReleaseVersion(application.candidate.version);
            notify(t('settingsPage.releaseCheckSuccess', { version: application.candidate?.version || '--' }), 'success');
        } catch (requestError) {
            notify(getErrorMessage(requestError, t('settingsPage.releaseCheckFailed')), 'error');
        } finally { setReleaseAction(null); }
    };

    const upgradeRelease = async () => {
        const version = releaseVersion.trim();
        if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
            notify(t('settingsPage.releaseVersionInvalid'), 'error');
            return;
        }
        if (!await confirm({
            title: t('settingsPage.upgradeConfirmTitle'),
            message: t('settingsPage.upgradeConfirmMessage', { version }),
            confirmLabel: t('settingsPage.upgradeNow')
        })) return;
        setReleaseAction('upgrade');
        try {
            const application = await SystemService.upgrade(version);
            setStatus(current => current ? { ...current, application } : current);
            notify(t('settingsPage.upgradeQueued'), 'info');
        } catch (requestError) {
            notify(getErrorMessage(requestError, t('settingsPage.upgradeFailed')), 'error');
        } finally { setReleaseAction(null); }
    };

    const rollbackRelease = async () => {
        const previous = status?.application?.previousVersion;
        if (!previous || !await confirm({
            title: t('settingsPage.rollbackConfirmTitle'),
            message: t('settingsPage.rollbackConfirmMessage', { version: previous }),
            confirmLabel: t('settingsPage.rollbackNow'),
            destructive: true
        })) return;
        setReleaseAction('rollback');
        try {
            const application = await SystemService.rollback();
            setStatus(current => current ? { ...current, application } : current);
            notify(t('settingsPage.rollbackQueued'), 'info');
        } catch (requestError) {
            notify(getErrorMessage(requestError, t('settingsPage.rollbackFailed')), 'error');
        } finally { setReleaseAction(null); }
    };

    const check = (label: string, ok: boolean, detail: string) => (
        <div className="grid grid-cols-[1.25rem_minmax(7rem,1fr)_minmax(0,1.5fr)] items-center gap-3 border-b border-[var(--border-color)] px-4 py-3 last:border-b-0 sm:grid-cols-[1.25rem_minmax(8rem,14rem)_minmax(0,1fr)]">
            {ok ? <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" /> : <XCircle size={16} className="text-red-500" aria-hidden="true" />}
            <span className="min-w-0 text-sm font-medium">{label}</span>
            <span className="min-w-0 break-words font-mono text-xs text-[var(--text-muted)]">{detail}</span>
        </div>
    );

    return (
        <div className="console-page">
            <section className="console-page-header">
                <div><h1>{t('settings')}</h1><p>{t('settingsPage.subtitle')}</p></div>
                <button type="button" className="console-button secondary" onClick={() => void load()} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {t('common.refresh')}
                </button>
            </section>

            {error && <div className="console-alert error" role="alert"><span>{error}</span><button type="button" className="console-button secondary" onClick={() => void load()}>{t('common.retry')}</button></div>}
            {loading && !status ? <div className="console-panel p-8 text-center text-sm text-[var(--text-muted)]">{t('common.loading')}</div> : status && <>
                {status.warnings.length > 0 && <div className="console-alert warning mb-4" role="status"><ShieldAlert size={18} aria-hidden="true" /><span>{status.warnings.map(warning => {
                    const translationKey = getSystemWarningTranslationKey(warning);
                    return translationKey ? t(translationKey) : warning;
                }).join(' · ')}</span></div>}

                <section className="console-panel mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
                        <div><h2 className="text-sm font-semibold">{t('settingsPage.releaseTitle')}</h2><p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('settingsPage.releaseDescription')}</p></div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                value={releaseVersion}
                                onChange={event => setReleaseVersion(event.target.value)}
                                placeholder="v1.2.3"
                                aria-label={t('settingsPage.releaseVersion')}
                                className="h-8 w-28 border border-[var(--border-color)] bg-[var(--bg-base)] px-2 font-mono text-xs outline-none focus:border-[var(--primary)]"
                                disabled={Boolean(releaseAction || ['queued', 'running'].includes(status.application?.operation?.status || ''))}
                            />
                            <button type="button" className="console-button secondary" onClick={() => void checkRelease()} disabled={Boolean(releaseAction)}><PackageCheck size={14} aria-hidden="true" />{t('settingsPage.checkRelease')}</button>
                            <button type="button" className="console-button primary" onClick={() => void upgradeRelease()} disabled={!status.application?.available || Boolean(releaseAction || ['queued', 'running'].includes(status.application?.operation?.status || ''))}>{t('settingsPage.upgradeNow')}</button>
                            <button type="button" className="console-button secondary" onClick={() => void rollbackRelease()} disabled={!status.application?.previousVersion || Boolean(releaseAction || ['queued', 'running'].includes(status.application?.operation?.status || ''))}><RotateCcw size={14} aria-hidden="true" />{t('settingsPage.rollbackNow')}</button>
                        </div>
                    </div>
                    {check(t('settingsPage.currentVersion'), Boolean(status.application?.available), status.application?.currentVersion || '--')}
                    {check(t('settingsPage.previousVersion'), Boolean(status.application?.previousVersion), status.application?.previousVersion || t('settingsPage.none'))}
                    {check(t('settingsPage.retainedVersions'), Boolean(status.application?.retainedVersions?.length), status.application?.retainedVersions?.join(', ') || '--')}
                    {status.application?.operation && check(t('settingsPage.releaseOperation'), status.application.operation.status === 'succeeded', `${t(`settingsPage.operationStatus.${status.application.operation.status}`)} · ${status.application.operation.phase ? t(`settingsPage.operationPhase.${status.application.operation.phase}`) : status.application.operation.message || '--'}${['failed', 'rolled_back'].includes(status.application.operation.status) && status.application.operation.message ? `: ${status.application.operation.message}` : ''}`)}
                    {status.application?.error && <div className="px-4 py-3 text-xs text-red-500">{status.application.error}</div>}
                </section>

                <section className="console-panel mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
                        <div><h2 className="text-sm font-semibold">{t('settingsPage.domainTitle')}</h2><p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('settingsPage.domainDescription')}</p></div>
                        {!status.configuration.confirmation.confirmed && <button type="button" className="console-button primary" disabled={confirming || !status.configuration.consoleHost || !status.configuration.projectsBaseDomain} onClick={() => void confirmDomains()}>{confirming ? t('settingsPage.confirming') : t('settingsPage.confirmDomains')}</button>}
                    </div>
                    {check(t('settingsPage.consoleHost'), status.configuration.observedHostMatches, `${status.configuration.consoleHost || '--'} (${status.configuration.observedHost || '--'})`)}
                    {check(t('settingsPage.projectsDomain'), Boolean(status.configuration.projectsBaseDomain), status.configuration.projectWildcard || '--')}
                    {check(t('settingsPage.confirmation'), status.configuration.confirmation.confirmed, status.configuration.confirmation.confirmedAt || t('settingsPage.notConfirmed'))}
                </section>

                <section className="console-panel mb-4">
                    <div className="border-b border-[var(--border-color)] px-4 py-3"><h2 className="text-sm font-semibold">{t('settingsPage.prerequisites')}</h2></div>
                    {check(t('settingsPage.cloudflareToken'), status.configuration.dnsProviderConfigured, status.configuration.dnsProviderConfigured ? t('settingsPage.configured') : t('settingsPage.missing'))}
                    {check(t('settingsPage.acmeEmail'), status.configuration.acmeEmailConfigured, status.configuration.acmeEmailConfigured ? t('settingsPage.configured') : t('settingsPage.missing'))}
                    {check(t('settingsPage.ingressToken'), status.configuration.ingressProxyConfigured, status.configuration.ingressProxyConfigured ? t('settingsPage.configured') : t('settingsPage.missing'))}
                    {check(t('settingsPage.consoleDns'), status.dns.console.ok, status.dns.console.addresses?.join(', ') || status.dns.console.error || '--')}
                    {check(t('settingsPage.wildcardDns'), status.dns.wildcard.ok, `${status.dns.probeHost}: ${status.dns.wildcard.addresses?.join(', ') || status.dns.wildcard.error || '--'}`)}
                </section>

                <section className="console-panel">
                    <div className="border-b border-[var(--border-color)] px-4 py-3"><h2 className="text-sm font-semibold">{t('settingsPage.certificates')}</h2></div>
                    {check(t('settingsPage.consoleCertificate'), Boolean(status.tls.console.ok && status.tls.console.authorized), status.tls.console.ok ? `${status.tls.console.issuer || '--'} / ${status.tls.console.daysRemaining ?? '--'} ${t('settingsPage.daysRemaining')}` : status.tls.console.error || '--')}
                    {check(t('settingsPage.wildcardCertificate'), Boolean(status.tls.wildcard.ok && status.tls.wildcard.authorized), status.tls.wildcard.ok ? `${status.tls.wildcard.subject || '--'} / ${status.tls.wildcard.daysRemaining ?? '--'} ${t('settingsPage.daysRemaining')}` : status.tls.wildcard.error || '--')}
                </section>
            </>}
        </div>
    );
};

export default Settings;
