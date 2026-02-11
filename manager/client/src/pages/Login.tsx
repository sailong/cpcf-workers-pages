import React, { useState, useEffect } from 'react';
import { AuthService } from '../services';

interface LoginProps {
    onLogin: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
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
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-yellow-500 mb-2">
                        CCFWP 管理后台
                    </h1>
                    <p className="text-gray-500">请验证您的身份以继续</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-500 text-sm mb-1">用户名</label>
                        <input
                            type="text"
                            value="admin"
                            readOnly
                            disabled
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-400 cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-500 text-sm mb-1">密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder-gray-600"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-gray-500 text-sm mb-1">验证码</label>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={captcha}
                                onChange={(e) => setCaptcha(e.target.value)}
                                placeholder="请输入验证码"
                                className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder-gray-600"
                            />
                            <div
                                className="w-32 h-12 bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={fetchCaptcha}
                                dangerouslySetInnerHTML={{ __html: captchaSvg }}
                                title="点击刷新"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm text-center">
                            {error === 'Login failed' ? '登录失败' : error === 'Connection failed' ? '连接失败' : error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-lg ${loading
                            ? 'bg-gray-700 cursor-not-allowed'
                            : 'bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 shadow-orange-900/20 transform hover:-translate-y-0.5'
                            }`}
                    >
                        {loading ? '验证中...' : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
