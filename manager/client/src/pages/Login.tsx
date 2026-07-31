import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { AuthService } from '../services';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import ChangePasswordModal from '../components/ChangePasswordModal';

interface LoginProps {
    onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [captcha, setCaptcha] = useState('');
    const [captchaId, setCaptchaId] = useState('');
    const [captchaSvg, setCaptchaSvg] = useState('');
    const [captchaLoading, setCaptchaLoading] = useState(true);
    const [captchaError, setCaptchaError] = useState('');
    const [serverOnline, setServerOnline] = useState<boolean | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

    const fetchCaptcha = useCallback(async () => {
        setCaptchaLoading(true);
        setCaptchaError('');
        try {
            const data = await AuthService.getCaptcha();
            setCaptchaSvg(data.image);
            setCaptchaId(data.captchaId);
        } catch {
            setCaptchaSvg('');
            setCaptchaId('');
            setCaptchaError(t('loginPage.captchaFailed'));
        } finally {
            setCaptchaLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void fetchCaptcha();
        let cancelled = false;
        const checkHealth = async () => {
            try {
                const response = await fetch('/api/health', { credentials: 'same-origin' });
                if (!cancelled) setServerOnline(response.ok);
            } catch {
                if (!cancelled) setServerOnline(false);
            }
        };
        void checkHealth();
        const timer = window.setInterval(() => void checkHealth(), 10_000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [fetchCaptcha]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!captchaId) {
            setCaptchaError(t('loginPage.captchaFailed'));
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await AuthService.login('admin', password, captcha, captchaId);
            if (response.success) {
                if (response.requirePasswordChange) setRequiresPasswordChange(true);
                else onLogin();
            } else {
                setError(response.error || t('loginPage.loginFailed'));
                setCaptcha('');
                await fetchCaptcha();
            }
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : t('loginPage.connectionFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[var(--bg-base)] text-[var(--text-main)]">
            <header className="flex h-14 items-center border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 sm:px-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="console-brand-mark">CF</span>
                    <span>Workers Console</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-4xl items-center px-4 py-10 sm:px-6 md:min-h-[calc(100dvh-3.5rem)]">
                <section className="grid w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm md:grid-cols-[15rem_minmax(0,1fr)]" aria-labelledby="login-title">
                    <aside className="border-b border-[var(--border-color)] bg-[var(--bg-subtle)] p-6 md:border-b-0 md:border-r">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
                            <Server size={15} aria-hidden="true" /> {t('loginPage.managerStatus')}
                        </div>
                        <div className="mt-5 flex items-center gap-2 text-sm">
                            <span className={`h-2 w-2 rounded-full ${serverOnline === true ? 'bg-emerald-500' : serverOnline === false ? 'bg-red-500' : 'bg-slate-400'}`} />
                            <span>{serverOnline === true ? t('online') : serverOnline === false ? t('offline') : t('loginPage.checking')}</span>
                        </div>
                        <div className="mt-6 border-t border-[var(--border-color)] pt-5">
                            <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                <span>{t('loginPage.secureSession')}</span>
                            </div>
                        </div>
                    </aside>

                    <div className="p-6 sm:p-8">
                        <div className="mb-6">
                            <h1 id="login-title" className="text-xl font-semibold">{t('loginPage.welcomeBack')}</h1>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">{t('loginPage.subtitle')}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="login-username" className="block text-sm font-medium">{t('loginPage.username')}</label>
                                <input id="login-username" type="text" value="admin" readOnly className="console-input w-full bg-[var(--bg-subtle)] font-mono" />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="login-password" className="block text-sm font-medium">{t('loginPage.password')}</label>
                                <div className="relative">
                                    <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" className="console-input w-full pr-11" autoFocus required />
                                    <button type="button" className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(value => !value)} title={showPassword ? t('loginPage.hidePassword') : t('loginPage.showPassword')} aria-label={showPassword ? t('loginPage.hidePassword') : t('loginPage.showPassword')}>
                                        {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="login-captcha" className="block text-sm font-medium">{t('loginPage.captcha')}</label>
                                <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                                    <input id="login-captcha" type="text" value={captcha} onChange={event => setCaptcha(event.target.value)} autoComplete="off" className="console-input min-w-0" required />
                                    <button type="button" onClick={() => void fetchCaptcha()} disabled={captchaLoading} className="flex h-10 items-center justify-center overflow-hidden rounded-md border border-[var(--border-color)] bg-white" title={t('loginPage.refreshCaptcha')} aria-label={t('loginPage.refreshCaptcha')}>
                                        {captchaLoading ? <RefreshCw size={16} className="animate-spin text-slate-500" aria-hidden="true" /> : captchaSvg ? <span className="block h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: captchaSvg }} /> : <RefreshCw size={16} className="text-slate-500" aria-hidden="true" />}
                                    </button>
                                </div>
                                {captchaError && <div className="flex items-center justify-between gap-3 text-xs text-red-600" role="alert"><span>{captchaError}</span><button type="button" className="underline" onClick={() => void fetchCaptcha()}>{t('common.retry')}</button></div>}
                            </div>

                            {error && <div className="console-alert error mb-0" role="alert"><span>{error === 'Login failed' ? t('loginPage.authFailed') : error}</span></div>}

                            <button type="submit" disabled={loading || captchaLoading || serverOnline === false} className="console-button primary w-full">
                                {loading ? t('loginPage.verifying') : t('loginPage.signIn')}
                            </button>
                        </form>
                    </div>
                </section>
            </main>

            {requiresPasswordChange && <ChangePasswordModal required onClose={() => undefined} onSuccess={() => {
                setRequiresPasswordChange(false);
                setPassword('');
                setCaptcha('');
                setError(t('auth.passwordChangedLoginAgain'));
                void fetchCaptcha();
            }} />}
        </div>
    );
};

export default Login;
