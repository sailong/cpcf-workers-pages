import React, { useState, useRef } from 'react';
import { authenticatedFetch } from '../api';
import WorkerForm from './worker-form';
import PagesForm from './pages-form';
import BuildForm from './build-form';
import type { SubFormHandle } from './types';

/** 三种可选的项目类型模式 */
type ProjectMode = 'worker' | 'pages' | 'build';

interface CreateProjectPageProps {
    onSuccess: () => void;
}

/**
 * 项目创建入口组件
 * 负责：类型模式选择、项目名称、端口配置、错误/成功提示、提交逻辑
 * 各类型的具体表单由子组件独立实现
 */
const CreateProjectPage: React.FC<CreateProjectPageProps> = ({ onSuccess }) => {
    // 共享状态
    const [mode, setMode] = useState<ProjectMode>('worker');
    const [name, setName] = useState('');
    const [customPort, setCustomPort] = useState<number | ''>('');
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Toast 状态
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // 子组件 ref
    const formRef = useRef<SubFormHandle>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    /** 统一创建逻辑 */
    const handleCreate = async () => {
        // 校验名称
        if (!name.trim()) {
            setError('项目名称不能为空');
            return;
        }

        const nameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        if (!nameRegex.test(name)) {
            setError('项目名称非法：只能包含字母/数字/连字符，且不能以连字符开头或结尾');
            return;
        }

        // 调用子组件获取 payload
        if (!formRef.current) {
            setError('表单未就绪');
            return;
        }

        const subPayload = await formRef.current.getPayload();
        if (!subPayload) return; // 子组件已设置 error

        setCreating(true);
        setError('');

        try {
            // NOTE: _file 是子组件传回的临时字段，不属于 API payload
            const fileToUpload = (subPayload as any)._file as File | undefined;
            delete (subPayload as any)._file;

            if (subPayload.type === 'worker' && subPayload.code) {
                // Worker 编辑器模式：直接 JSON 提交
                const payload = {
                    ...subPayload,
                    name,
                    port: customPort || undefined,
                };

                const res = await authenticatedFetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || '创建失败');
                }

                setSuccessMsg('Worker 创建成功！正在跳转...');
                setTimeout(() => { onSuccess(); }, 1500);
            } else {
                // 上传模式（Worker上传 / Pages / Build）
                if (!fileToUpload) throw new Error('文件不存在');

                const formData = new FormData();
                formData.append('file', fileToUpload);

                const uploadRes = await authenticatedFetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadRes.ok) {
                    throw new Error('文件上传失败');
                }

                const { filename: uploadedFilename } = await uploadRes.json();

                const payload = {
                    ...subPayload,
                    name,
                    mainFile: uploadedFilename,
                    port: customPort || undefined,
                };

                const res = await authenticatedFetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || '创建失败');
                }

                const typeLabel = subPayload.type === 'worker' ? 'Worker' : 'Pages';
                setSuccessMsg(`${typeLabel} 创建成功！正在跳转...`);
                setTimeout(() => { onSuccess(); }, 1500);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '创建失败');
            console.error(err);
            setCreating(false);
        }
    };

    /**
     * 根据当前模式判断创建按钮是否应禁用
     * Build 模式需要额外检查 buildId（通过 ref 判断不方便，简化为不禁用）
     */
    const isCreateDisabled = creating;

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            {/* Toast 提示 */}
            {toast && (
                <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg text-white font-medium animate-fade-in-down z-[70] ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                    {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
                </div>
            )}

            {/* 成功提示弹窗 */}
            {successMsg && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity">
                    <div className="bg-gray-800 border border-green-500/50 p-8 rounded-xl shadow-2xl flex flex-col items-center gap-4 transform scale-100 transition-transform">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500">
                            <span className="text-3xl">✅</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white">{successMsg}</h3>
                        <p className="text-gray-400">页面将自动返回项目列表...</p>
                    </div>
                </div>
            )}

            {/* 项目名称 */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    项目名称 * <span className="text-xs text-gray-500 font-normal ml-2">(字母/数字/连字符，不能以连字符开头结尾)</span>
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={mode === 'worker' ? 'my-worker' : 'my-static-site'}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
            </div>

            {/* 项目类型选择 */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                    项目类型 *
                </label>
                <div className="flex gap-4">
                    <button
                        onClick={() => setMode('worker')}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${mode === 'worker'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">⚡️</div>
                        <div className="font-bold">Workers</div>
                        <div className="text-xs mt-1 opacity-80">Serverless 函数</div>
                    </button>

                    <button
                        onClick={() => setMode('pages')}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${mode === 'pages'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">📄</div>
                        <div className="font-bold">Pages</div>
                        <div className="text-xs mt-1 opacity-80">静态网站 hosting</div>
                    </button>

                    <button
                        onClick={() => setMode('build')}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${mode === 'build'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">🛠️</div>
                        <div className="font-bold">Build</div>
                        <div className="text-xs mt-1 opacity-80">构建并部署</div>
                    </button>
                </div>
            </div>

            {/* 根据模式渲染对应子表单 — 切换时子组件卸载，内部状态自动清空 */}
            {mode === 'worker' && (
                <WorkerForm ref={formRef} setError={setError} showToast={showToast} />
            )}
            {mode === 'pages' && (
                <PagesForm ref={formRef} setError={setError} showToast={showToast} />
            )}
            {mode === 'build' && (
                <BuildForm ref={formRef} setError={setError} showToast={showToast} />
            )}

            {/* 端口配置 */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    端口（可选）
                </label>
                <input
                    type="number"
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="留空自动分配 (默认为内部端口)"
                    min="1024"
                    max="65535"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="mt-2 space-y-1 bg-gray-900/50 p-3 rounded border border-gray-700">
                    <p className="text-xs text-gray-400 font-bold mb-1">ℹ️ 关于端口说明：</p>
                    <ul className="text-xs text-gray-500 list-disc pl-4 space-y-1">
                        <li>无论留空还是手动填写，此端口均为 <strong>容器内部端口</strong>。</li>
                        <li>外部无法直接访问（除非通过反向代理域名）。</li>
                        <li>如需直接通过 IP:Port 访问，必须在 <code>docker-compose.yml</code> 中添加映射。</li>
                    </ul>
                </div>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* 创建按钮 */}
            <div className="flex gap-3 pt-4">
                <button
                    onClick={handleCreate}
                    disabled={isCreateDisabled}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold rounded-lg disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-orange-500/50"
                >
                    {creating ? '创建中...' : '🚀 创建并部署'}
                </button>
            </div>
        </div>
    );
};

export default CreateProjectPage;
