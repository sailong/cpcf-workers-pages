import React, { useState, useEffect } from 'react';
import { AuthService } from '../services';
import { useTheme } from '../contexts/ThemeContext';

interface LoginProps {
    onLogin: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
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
                setError(res.error || 'Login failed');
                fetchCaptcha();
                setCaptcha('');
            }
        } catch (err: any) {
            setError(err.message || 'Connection failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden transition-colors duration-300">
            {/* Theme Toggle in Login */}
            <div className="absolute top-6 right-6 z-50">
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
            {/* Background Decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="glass-card p-10 w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold mb-2 tracking-tight">
                        欢迎回来
                    </h1>
                    <p className="opacity-40 text-sm font-medium">Sign in to CCFWP Manager</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 text-xs font-bold uppercase mb-2 ml-1">用户名</label>
                        <input
                            type="text"
                            value="admin"
                            readOnly
                            disabled
                            className="input-liquid w-full p-3 opacity-50 cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-xs font-bold uppercase mb-2 ml-1">密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            className="input-liquid w-full p-3"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-xs font-bold uppercase mb-2 ml-1">验证码</label>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={captcha}
                                onChange={(e) => setCaptcha(e.target.value)}
                                placeholder="验证码"
                                className="input-liquid flex-1 p-3"
                            />
                            <div
                                className="w-32 h-[46px] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-black/5 dark:border-white/10 flex items-center justify-center bg-white/50 backdrop-blur-md dark:bg-transparent dark:invert"
                                onClick={fetchCaptcha}
                                dangerouslySetInnerHTML={{ __html: captchaSvg }}
                                title="点击刷新"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                            {error === 'Login failed' ? '登录失败，请检查密码或验证码' : error === 'Connection failed' ? '连接失败' : error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary py-3.5 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {loading ? '验证中...' : '登 录'}
                    </button>
                </form>
            </div>

            <div className="absolute bottom-6 text-center text-gray-600 text-xs">
                &copy; {new Date().getFullYear()} CCFWP Manager. All rights reserved.
            </div>
        </div>
    );
};

export default Login;
