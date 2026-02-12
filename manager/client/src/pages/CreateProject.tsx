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
            <header className="max-w-4xl mx-auto w-full flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                <div>
                    <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tight">New Project</h1>
                    <p className="text-[var(--text-muted)] mt-1 font-medium">Deploy your code to the global edge network.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="btn-glass"
                    >
                        <span>← Back</span>
                    </button>

                    <div className="h-8 w-px bg-current opacity-10 mx-2"></div>

                    <div className="flex items-center gap-2 bg-white/10 p-1 rounded-2xl border border-white/20 backdrop-blur-md">
                        <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-white/20 transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
                            {theme === 'dark' ? '🌙' : '☀️'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                {/* 1. Type Selection */}
                <div className="neo-card p-8">
                    <label className="block text-[var(--color-primary)] text-xs font-bold uppercase mb-6 ml-1 tracking-widest">1. Select Project Type</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { id: 'worker', label: 'Worker', icon: '⚡️', desc: 'High-performance edge functions' },
                            { id: 'pages', label: 'Pages', icon: '📄', desc: 'Static site hosting' },
                            { id: 'build', label: 'Build', icon: '🛠️', desc: 'CI/CD Pipelines' }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMode(m.id as ProjectMode)}
                                className={`relative p-6 rounded-2xl border transition-all text-left group overflow-hidden ${mode === m.id
                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-lg shadow-indigo-500/10'
                                    : ' hover:border-white/50 border border-black/5 hover:border-black/10 shadow-sm dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10 dark:hover:border-white/10'
                                    }`}
                            >
                                <div className={`text-4xl mb-4 transition-transform duration-300 ${mode === m.id ? 'scale-110' : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'}`}>{m.icon}</div>
                                <div className={`font-bold text-lg capitalize mb-1 ${mode === m.id ? 'text-[var(--color-primary)]' : 'text-[var(--text-main)]'}`}>{m.label}</div>
                                <div className="text-xs text-[var(--text-muted)] leading-relaxed">{m.desc}</div>
                                {mode === m.id && (
                                    <div className="absolute top-3 right-3 text-[var(--color-primary)]">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Basic Info */}
                <div className="neo-card p-8 space-y-6">
                    <label className="block text-[var(--color-primary)] text-xs font-bold uppercase mb-2 ml-1 tracking-widest">2. Basic Information</label>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[var(--text-muted)] text-xs font-bold uppercase mb-2 ml-1">Project Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={mode === 'worker' ? 'my-awesome-worker' : 'my-static-site'}
                                className="neo-input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-[var(--text-muted)] text-xs font-bold uppercase mb-2 ml-1">Internal Port (Optional)</label>
                            <input
                                type="number"
                                value={customPort}
                                onChange={(e) => setCustomPort(e.target.value ? parseInt(e.target.value) : '')}
                                placeholder="Auto-assigned if empty"
                                className="neo-input w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Detailed Config */}
                <div className="neo-card p-8">
                    <label className="block text-[var(--color-primary)] text-xs font-bold uppercase mb-6 ml-1 tracking-widest">3. Configuration</label>
                    {mode === 'worker' && <WorkerForm ref={formRef} setError={setError} showToast={showToast} />}
                    {mode === 'pages' && <PagesForm ref={formRef} setError={setError} showToast={showToast} />}
                    {mode === 'build' && <BuildForm ref={formRef} setError={setError} showToast={showToast} />}
                </div>

                {/* 4. Action */}
                <div className="pb-20">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-4 rounded-2xl flex items-center gap-3 mb-6 backdrop-blur-md">
                            <span className="text-xl">⚠️</span><span>{error}</span>
                        </div>
                    )}
                    <button
                        onClick={handleCreate}
                        disabled={isCreateDisabled}
                        className="w-full btn-gradient text-xl py-4 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? '🚀 Deploying...' : 'Create & Deploy'}
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
