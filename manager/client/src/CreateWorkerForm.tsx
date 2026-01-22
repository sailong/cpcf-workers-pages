import { useState } from 'react';
import Editor from '@monaco-editor/react';

interface CreateWorkerFormProps {
    onSuccess: () => void;
}

type CodeSource = 'upload' | 'editor';

const CreateWorkerForm: React.FC<CreateWorkerFormProps> = ({ onSuccess }) => {
    const [name, setName] = useState('');
    const [codeSource, setCodeSource] = useState<CodeSource>('editor');
    const [code, setCode] = useState(`export default {
  async fetch(request, env, ctx) {
    return new Response("Hello World!");
  }
}`);
    const [filename, setFilename] = useState('worker.js');
    const [file, setFile] = useState<File | null>(null);
    const [customPort, setCustomPort] = useState<number | ''>('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const [successMsg, setSuccessMsg] = useState('');

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('项目名称不能为空');
            return;
        }

        if (codeSource === 'editor') {
            if (!code.trim()) {
                setError('代码不能为空');
                return;
            }
            if (!filename.trim()) {
                setError('文件名不能为空');
                return;
            }
        } else {
            if (!file) {
                setError('请选择文件');
                return;
            }
        }

        setCreating(true);
        setError('');

        try {
            if (codeSource === 'editor') {
                // 使用代码直接创建
                const payload = {
                    name,
                    type: 'worker',
                    code,
                    filename,
                    port: customPort || undefined,
                    bindings: { kv: [], d1: [] },
                    envVars: {}
                };

                const res = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || '创建失败');
                }

                setSuccessMsg('Worker 创建成功！正在跳转...');
                setTimeout(() => {
                    onSuccess();
                }, 1500);
            } else {
                // 使用文件上传创建
                const formData = new FormData();
                if (!file) throw new Error('文件不存在');
                formData.append('file', file);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!uploadRes.ok) {
                    throw new Error('文件上传失败');
                }

                const { filename: uploadedFilename } = await uploadRes.json();

                const payload = {
                    name,
                    type: 'worker',
                    mainFile: uploadedFilename,
                    port: customPort || undefined,
                    bindings: { kv: [], d1: [] },
                    envVars: {}
                };

                const res = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || '创建失败');
                }

                setSuccessMsg('Worker 创建成功！正在跳转...');
                setTimeout(() => {
                    onSuccess();
                }, 1500);
            }

            // 不需要重置表单了，因为会跳转离开
        } catch (err) {
            setError(err instanceof Error ? err.message : '创建失败');
            console.error(err);
            setCreating(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            {/* Success Modal */}
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
                    项目名称 *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-worker"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
            </div>

            {/* 代码来源选择 */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                    代码来源 *
                </label>
                <div className="flex gap-4">
                    <button
                        onClick={() => setCodeSource('editor')}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${codeSource === 'editor'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">✏️</div>
                        <div className="font-bold">在线编写</div>
                        <div className="text-xs mt-1 opacity-80">使用代码编辑器</div>
                    </button>

                    <button
                        onClick={() => setCodeSource('upload')}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${codeSource === 'upload'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">📁</div>
                        <div className="font-bold">上传文件</div>
                        <div className="text-xs mt-1 opacity-80">从本地选择文件</div>
                    </button>
                </div>
            </div>

            {/* 代码输入区域 */}
            {codeSource === 'editor' ? (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            文件名 *
                        </label>
                        <input
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            placeholder="worker.js"
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">支持 .js 或 .ts 文件</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Worker 代码 *
                        </label>
                        <div className="border-2 border-gray-700 rounded-lg overflow-hidden">
                            <Editor
                                height="400px"
                                language={filename.endsWith('.ts') ? 'typescript' : 'javascript'}
                                value={code}
                                onChange={(value) => setCode(value || '')}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    tabSize: 2,
                                    insertSpaces: true,
                                }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        选择文件 *
                    </label>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".js,.ts"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="hidden"
                            id="worker-file-upload"
                        />
                        <label
                            htmlFor="worker-file-upload"
                            className="block w-full px-4 py-8 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg text-center cursor-pointer hover:border-orange-500 hover:bg-gray-800/50 transition-colors"
                        >
                            {file ? (
                                <div>
                                    <div className="text-4xl mb-2">📄</div>
                                    <div className="text-white font-medium">{file.name}</div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {(file.size / 1024).toFixed(2)} KB
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-4xl mb-2">📁</div>
                                    <div className="text-gray-400">点击选择文件</div>
                                    <div className="text-sm text-gray-600 mt-1">支持 .js 和 .ts 文件</div>
                                </div>
                            )}
                        </label>
                    </div>
                </div>
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
                    placeholder="留空自动分配 (8000-9000)"
                    min="1024"
                    max="65535"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
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
                    disabled={creating}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold rounded-lg disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-orange-500/50"
                >
                    {creating ? '创建中...' : '🚀 创建并部署'}
                </button>
            </div>
        </div>
    );
};

export default CreateWorkerForm;
