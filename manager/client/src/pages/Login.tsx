import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services';
import { useTheme } from '../contexts/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface LoginProps {
    onLogin: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const [password, setPassword] = useState('');
    const [captcha, setCaptcha] = useState('');
    const [captchaId, setCaptchaId] = useState('');
    const [captchaSvg, setCaptchaSvg] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchCaptcha = async () => {
        try {
            const data = await AuthService.getCaptcha();
            setCaptchaSvg(data.image);
            setCaptchaId(data.captchaId);
        } catch (e) {
            console.error("Failed to fetch captcha");
        }
    };

    useEffect(() => {
        fetchCaptcha();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await AuthService.login('admin', password, captcha, captchaId);
            if (res.success && res.token) {
                onLogin(res.token);
            } else {
                setError(res.error || t('loginPage.loginFailed'));
                fetchCaptcha();
                setCaptcha('');
            }
        } catch (err: any) {
            setError(err.message || t('loginPage.connectionFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden transition-colors duration-300">
            {/* Theme Toggle in Login */}
            <div className="absolute top-6 right-6 z-50 flex gap-2">
                <LanguageSwitcher className="glass border-transparent" />
                <button
                    onClick={toggleTheme}
                    className="glass border-transparent p-2.5 rounded-xl transition-all active:scale-95 shadow-lg"
                    title={theme === 'dark' ? '切换亮色' : '切换暗色'}
                >
                    {theme === 'dark' ? (
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707" />
                            <circle cx="12" cy="12" r="4" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>
            </div>
            {/* Background Decoration - Orbs are now global in App.tsx */}
            <div className="neo-card p-10 w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black mb-2 tracking-tight text-[var(--color-primary)]">
                        {t('loginPage.welcomeBack')}
                    </h1>
                    <p className="text-[var(--text-muted)] text-sm font-medium">{t('loginPage.subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[var(--text-muted)] text-xs font-bold uppercase mb-2 ml-1">{t('loginPage.username')}</label>
                        <input
                            type="text"
                            value="admin"
                            readOnly
                            disabled
                            className="neo-input w-full opacity-50 cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <div>
                            <label className="block text-[var(--text-muted)] text-xs font-bold uppercase mb-2 ml-1">{t('loginPage.password')}</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('loginPage.enterPassword')}
                                className="neo-input w-full"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-[var(--text-muted)] text-xs font-bold uppercase mb-2 ml-1">{t('loginPage.captcha')}</label>
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={captcha}
                                    onChange={(e) => setCaptcha(e.target.value)}
                                    placeholder={t('loginPage.code')}
                                    className="neo-input flex-1"
                                />
                                <div
                                    className="w-32 h-[46px] rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-black/5 dark:border-white/10 flex items-center justify-center bg-white/50 backdrop-blur-md dark:bg-white/10"
                                    onClick={fetchCaptcha}
                                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                                    title={t('loginPage.refreshCaptcha')}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-2xl text-sm text-center font-medium backdrop-blur-md">
                                {error === 'Login failed' ? t('loginPage.authFailed') : error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-gradient py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-xl"
                        >
                            {loading ? t('loginPage.verifying') : t('loginPage.signIn')}
                        </button>
                    </div>
                </form>
            </div>

            <div className="absolute bottom-6 text-center text-gray-600 text-xs">
                &copy; {new Date().getFullYear()} {t('loginPage.copyright')}
            </div>
        </div >
    );
};

export default Login;
