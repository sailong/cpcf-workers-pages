import React, { useState, useRef } from 'react';
import { api } from '../services'; // Use new API service
import WorkerForm from '../create-project/worker-form';
import PagesForm from '../create-project/pages-form';
import BuildForm from '../create-project/build-form';
// Type definition is likely in create-project/types.ts
import type { SubFormHandle } from '../create-project/types';

// Redirect helper
import { useNavigate } from 'react-router-dom';

/** Three modes */
type ProjectMode = 'worker' | 'pages' | 'build';

const CreateProject: React.FC = () => {
    const navigate = useNavigate();

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
        // Validation
        if (!name.trim()) {
            setError('项目名称不能为空');
            return;
        }

        const nameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        if (!nameRegex.test(name)) {
            setError('名称无效：仅允许字母、数字、连字符，且不能以连字符开头或结尾。');
            return;
        }

        // Get Payload
        if (!formRef.current) {
            setError('表单未就绪');
            return;
        }

        const subPayload = await formRef.current.getPayload();
        if (!subPayload) return; // Child set error

        setCreating(true);
        setError('');

        try {
            // Extract file if present (not part of JSON payload)
            // @ts-ignore
            const fileToUpload = subPayload._file as File | undefined;
            // @ts-ignore
            delete subPayload._file;

            if (subPayload.type === 'worker' && subPayload.code) {
                // Worker Editor Mode: Direct JSON
                const payload = {
                    ...subPayload,
                    name,
                    port: customPort || undefined,
                };

                const res = await api.post('/projects', payload);
                // Axios throws on error usually, handled in catch

                setSuccessMsg('Worker 创建成功！正在跳转...');
                setTimeout(() => navigate('/'), 1500);

            } else {
                // Upload Mode
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
        <div className="min-h-screen bg-black text-gray-200 p-6 md:p-10 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">新建项目</h1>
                        <p className="text-gray-500 text-sm mt-1">Create a new Worker, Pages, or Build project</p>
                    </div>
                    <button onClick={() => navigate('/')} className="glass-button px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
                        <span>←</span> 返回控制台
                    </button>
                </div>

                <div className="grid gap-8">
                    {/* Project Type */}
                    <div className="glass-card p-8">
                        <label className="block text-gray-500 text-xs font-bold uppercase mb-4 ml-1">选择项目类型</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {['worker', 'pages', 'build'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m as ProjectMode)}
                                    className={`relative p-6 rounded-2xl border-2 transition-all text-left group overflow-hidden ${mode === m
                                        ? 'border-blue-500/50 bg-blue-500/10 text-white shadow-lg shadow-blue-900/20'
                                        : 'border-transparent bg-[#2c2c2e] text-gray-400 hover:bg-[#3a3a3c] hover:text-gray-200'
                                        }`}
                                >
                                    <div className="text-3xl mb-3">{m === 'worker' ? '⚡️' : m === 'pages' ? '📄' : '🛠️'}</div>
                                    <div className="font-bold text-lg capitalize mb-1">{m}</div>
                                    <div className="text-xs opacity-60 font-medium">
                                        {m === 'worker' ? '高性能边缘计算函数' : m === 'pages' ? '静态网站托管' : 'CI/CD 构建流水线'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Basic Info */}
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

                    {/* Detailed Config (Sub Forms) */}
                    <div className="glass-card p-8">
                        <label className="block text-gray-500 text-xs font-bold uppercase mb-6 ml-1">详细配置</label>
                        {mode === 'worker' && <WorkerForm ref={formRef} setError={setError} showToast={showToast} />}
                        {mode === 'pages' && <PagesForm ref={formRef} setError={setError} showToast={showToast} />}
                        {mode === 'build' && <BuildForm ref={formRef} setError={setError} showToast={showToast} />}
                    </div>
                </div>

                {/* Error & Submit */}
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

            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl text-white font-medium z-[100] flex items-center gap-3 backdrop-blur-md border border-white/10 ${toast.type === 'error' ? 'bg-red-500/80 shadow-red-900/50' : 'bg-green-500/80 shadow-green-900/50'}`}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* Success Modal */}
            {successMsg && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="glass-card p-10 text-center max-w-sm mx-4 transform scale-100 animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🎉</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">创建成功!</h3>
                        <p className="text-gray-400 mb-6">{successMsg}</p>
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateProject;
