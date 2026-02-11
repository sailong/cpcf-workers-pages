import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services';
import { useTheme } from '../contexts/ThemeContext';
import WorkerForm from '../create-project/worker-form';
import PagesForm from '../create-project/pages-form';
import BuildForm from '../create-project/build-form';
import type { SubFormHandle } from '../create-project/types';

/** Three modes */
type ProjectMode = 'worker' | 'pages' | 'build';

const CreateProject: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    // Shared State
    const [mode, setMode] = useState<ProjectMode>('worker');
    const [name, setName] = useState('');
    const [customPort, setCustomPort] = useState<number | ''>('');
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Toast State
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Ref
    const formRef = useRef<SubFormHandle>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    /** Create Logic */
    const handleCreate = async () => {
        if (!name.trim()) {
            setError('项目名称不能为空');
            return;
        }

        const nameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        if (!nameRegex.test(name)) {
            setError('名称无效：仅允许字母、数字、连字符，且不能以连字符开头或结尾。');
            return;
        }

        if (!formRef.current) {
            setError('表单未就绪');
            return;
        }

        const subPayload = await formRef.current.getPayload();
        if (!subPayload) return;

        setCreating(true);
        setError('');

        try {
            // @ts-ignore
            const fileToUpload = subPayload._file as File | undefined;
            // @ts-ignore
            delete subPayload._file;

            if (subPayload.type === 'worker' && subPayload.code) {
                const payload = {
                    ...subPayload,
                    name,
                    port: customPort || undefined,
                };
                await api.post('/projects', payload);
                setSuccessMsg('Worker 创建成功！正在跳转...');
                setTimeout(() => navigate('/'), 1500);
            } else {
                if (!fileToUpload) throw new Error('缺少文件');
                const formData = new FormData();
                formData.append('file', fileToUpload);

                const uploadRes = await api.post('/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                const { filename: uploadedFilename } = uploadRes.data;
                const payload = {
                    ...subPayload,
                    name,
                    mainFile: uploadedFilename,
                    port: customPort || undefined,
                };

                await api.post('/projects', payload);
                const typeLabel = subPayload.type === 'worker' ? 'Worker' : 'Pages';
                setSuccessMsg(`${typeLabel} 创建成功！正在跳转...`);
                setTimeout(() => navigate('/'), 1500);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || '创建失败');
            console.error(err);
            setCreating(false);
        }
    };

    const isCreateDisabled = creating;

    return (
        <div className="min-h-screen p-6 md:p-10 font-sans transition-colors duration-300">
            <header className="max-w-7xl mx-auto flex justify-between items-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">新建项目</h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">部署您的代码到全球边缘网络</p>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="glass-button px-5 py-2.5 rounded-xl font-medium flex items-center gap-2">
                        <span className="text-lg">⬅️</span>
                        <span>返回控制台</span>
                    </button>

                    <div className="h-6 w-px bg-current opacity-10 mx-2"></div>

                    <button
                        onClick={toggleTheme}
                        className="opacity-60 hover:opacity-100 transition-all p-2"
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
            </header>

            <div className="max-w-4xl mx-auto">
                <div className="grid gap-8">
                    <div className="glass-card p-8">
                        <label className="block text-gray-500 text-xs font-bold uppercase mb-4 ml-1 tracking-widest">选择项目类型</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { id: 'worker', label: 'Worker', icon: '⚡️', desc: '高性能边缘计算函数' },
                                { id: 'pages', label: 'Pages', icon: '📄', desc: '静态网站托管' },
                                { id: 'build', label: 'Build', icon: '🛠️', desc: 'CI/CD 构建流水线' }
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMode(m.id as ProjectMode)}
                                    className={`relative p-6 rounded-2xl border-2 transition-all text-left group overflow-hidden ${mode === m.id
                                        ? 'border-blue-500/50 bg-blue-500/10 dark:text-white text-blue-700 shadow-lg shadow-blue-500/10'
                                        : 'border-transparent glass opacity-60 hover:opacity-100 hover:bg-current/5'
                                        }`}
                                >
                                    <div className={`text-3xl mb-3 transition-transform duration-300 ${mode === m.id ? 'scale-110' : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'}`}>{m.icon}</div>
                                    <div className="font-bold text-lg capitalize mb-1">{m.label}</div>
                                    <div className="text-xs opacity-60 font-medium leading-relaxed">{m.desc}</div>
                                    {mode === m.id && (
                                        <div className="absolute top-2 right-2 text-blue-400">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card p-8 space-y-6">
                        <div>
                            <label className="block text-gray-500 text-xs font-bold uppercase mb-2 ml-1">项目名称</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={mode === 'worker' ? 'my-awesome-worker' : 'my-static-site'}
                                className="input-liquid w-full p-4 text-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-500 text-xs font-bold uppercase mb-2 ml-1">内部端口 (可选)</label>
                            <input
                                type="number"
                                value={customPort}
                                onChange={(e) => setCustomPort(e.target.value ? parseInt(e.target.value) : '')}
                                placeholder="留空则自动分配"
                                className="input-liquid w-full p-4"
                            />
                        </div>
                    </div>

                    <div className="glass-card p-8">
                        <label className="block text-gray-500 text-xs font-bold uppercase mb-6 ml-1">详细配置</label>
                        {mode === 'worker' && <WorkerForm ref={formRef} setError={setError} showToast={showToast} />}
                        {mode === 'pages' && <PagesForm ref={formRef} setError={setError} showToast={showToast} />}
                        {mode === 'build' && <BuildForm ref={formRef} setError={setError} showToast={showToast} />}
                    </div>
                </div>

                <div className="mt-8 mb-20">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 mb-6">
                            <span className="text-xl">⚠️</span><span>{error}</span>
                        </div>
                    )}
                    <button
                        onClick={handleCreate}
                        disabled={isCreateDisabled}
                        className="w-full btn-primary py-4 text-xl font-bold shadow-xl shadow-blue-900/30 disabled:opacity-50"
                    >
                        {creating ? '🚀 创建部署中...' : '立即创建项目'}
                    </button>
                </div>
            </div>

            {toast && (
                <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl text-white font-medium z-[100] flex items-center gap-3 backdrop-blur-md border border-white/10 ${toast.type === 'error' ? 'bg-red-500/80 shadow-red-900/50' : 'bg-green-500/80 shadow-green-900/50'}`}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span>{toast.msg}</span>
                </div>
            )}

            {successMsg && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="glass-card p-10 text-center max-w-sm mx-4 transform scale-100 animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🎉</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">创建成功!</h3>
                        <p className="opacity-60 mb-6">{successMsg}</p>
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateProject;
