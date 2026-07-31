import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import type { SystemStatus } from '../types';
import { SystemService } from '../services';
import { useFeedback } from '../contexts/feedback-context';
import { getErrorMessage } from '../utils/errors';
import { getSystemWarningTranslationKey } from '../utils/system-warnings';

const Settings = () => {
    const { t } = useTranslation();
    const { notify } = useFeedback();
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
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
