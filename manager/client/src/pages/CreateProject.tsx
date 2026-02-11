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
        <div className="max-w-5xl mx-auto p-6 space-y-6 text-gray-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">新建项目</h1>
                <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">返回控制台</button>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg text-white font-medium z-[70] ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                    {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
                </div>
            )}

            {/* Success Modal */}
            {successMsg && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-green-500/50 p-8 rounded-xl flex flex-col items-center gap-4">
                        <div className="text-3xl">✅</div>
                        <h3 className="text-2xl font-bold text-white">{successMsg}</h3>
                    </div>
                </div>
            )}

            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">项目名称 *</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={mode === 'worker' ? 'my-worker' : 'my-static-site'}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500"
                />
            </div>

            {/* Type */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">项目类型 *</label>
                <div className="flex gap-4">
                    {['worker', 'pages', 'build'].map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m as ProjectMode)}
                            className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all capitalize ${mode === m
                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                }`}
                        >
                            <div className="text-2xl mb-2">{m === 'worker' ? '⚡️' : m === 'pages' ? '📄' : '🛠️'}</div>
                            <div className="font-bold">{m}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Sub Forms */}
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                {mode === 'worker' && <WorkerForm ref={formRef} setError={setError} showToast={showToast} />}
                {mode === 'pages' && <PagesForm ref={formRef} setError={setError} showToast={showToast} />}
                {mode === 'build' && <BuildForm ref={formRef} setError={setError} showToast={showToast} />}
            </div>

            {/* Port */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">内部端口 (可选)</label>
                <input
                    type="number"
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="留空则自动分配"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                    <span>⚠️</span><span>{error}</span>
                </div>
            )}

            // Submit
            <div className="pt-4">
                <button
                    onClick={handleCreate}
                    disabled={isCreateDisabled}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold rounded-lg disabled:opacity-50 transition-all"
                >
                    {creating ? '创建中...' : '🚀 创建并部署'}
                </button>
            </div>
        </div>
    );
};

export default CreateProject;
