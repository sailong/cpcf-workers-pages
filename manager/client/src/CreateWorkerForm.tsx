import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import JSZip from 'jszip';

interface CreateWorkerFormProps {
    onSuccess: () => void;
}

type CodeSource = 'editor' | 'upload';

const CreateWorkerForm: React.FC<CreateWorkerFormProps> = ({ onSuccess }) => {
    const [name, setName] = useState('');
    const [projectType, setProjectType] = useState<'worker' | 'pages'>('worker');
    const [codeSource, setCodeSource] = useState<CodeSource>('editor');

    // Pages Upload Type
    const [uploadType, setUploadType] = useState<'zip' | 'folder'>('folder');

    const [code, setCode] = useState(`export default {
  async fetch(request, env, ctx) {
    return new Response("Hello World!");
  }
}`);
    const [filename, setFilename] = useState('worker.js');
    const [file, setFile] = useState<File | null>(null);
    const [customPort, setCustomPort] = useState<number | ''>('');
    const [creating, setCreating] = useState(false);
    const [processing, setProcessing] = useState(false); // For zipping
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setProcessing(true);
        setError('');

        try {
            const zip = new JSZip();

            // Check for common root folder
            const fileArray = Array.from(files);
            if (fileArray.length > 0) {
                // Get the first part of the path of the first file
                // e.g., "dist/index.html" -> "dist"
                const firstPathParts = fileArray[0].webkitRelativePath.split('/');

                // Only consider stripping if there is at least one folder level
                if (firstPathParts.length > 1) {
                    const candidateRoot = firstPathParts[0] + '/';
                    // Check if all files start with this root
                    const hasCommonRoot = fileArray.every(f => f.webkitRelativePath.startsWith(candidateRoot));

                    if (hasCommonRoot) {
                        // Strip the root folder
                        fileArray.forEach(file => {
                            // "dist/index.html" -> "index.html"
                            const cleanPath = file.webkitRelativePath.substring(candidateRoot.length);
                            // Only add if path is not empty (e.g. if the folder itself is included as a file entry)
                            if (cleanPath) {
                                zip.file(cleanPath, file);
                            }
                        });
                    } else {
                        // No common root, add as is
                        fileArray.forEach(file => {
                            zip.file(file.webkitRelativePath, file);
                        });
                    }
                } else {
                    // Files at root (unlikely for webkitdirectory unless flat selection), add as is
                    fileArray.forEach(file => {
                        zip.file(file.webkitRelativePath, file);
                    });
                }
            }


            const content = await zip.generateAsync({ type: "blob" });
            // Create a File object from Blob
            const zipFile = new File([content], "project.zip", { type: "application/zip" });
            setFile(zipFile);
        } catch (err) {
            console.error(err);
            setError("文件夹打包失败");
        } finally {
            setProcessing(false);
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('项目名称不能为空');
            return;
        }

        if (projectType === 'worker' && codeSource === 'editor') {
            if (!code.trim()) {
                setError('代码不能为空');
                return;
            }
            if (!filename.trim()) {
                setError('文件名不能为空');
                return;
            }
        } else {
            // Upload (Worker or Pages)
            if (!file) {
                setError('请选择文件');
                return;
            }
        }

        setCreating(true);
        setError('');

        try {
            if (projectType === 'worker' && codeSource === 'editor') {
                // ... (Worker Editor Logic - Same as before)
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
                setTimeout(() => { onSuccess(); }, 1500);
            } else {
                // Upload Logic
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
                    type: projectType,
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

                setSuccessMsg(`${projectType === 'worker' ? 'Worker' : 'Pages'} 创建成功！正在跳转...`);
                setTimeout(() => { onSuccess(); }, 1500);
            }

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
                    placeholder={projectType === 'worker' ? "my-worker" : "my-static-site"}
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
                        onClick={() => {
                            setProjectType('worker');
                            setCodeSource('editor');
                            setFile(null);
                        }}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${projectType === 'worker'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">⚡️</div>
                        <div className="font-bold">Workers</div>
                        <div className="text-xs mt-1 opacity-80">Serverless 函数</div>
                    </button>

                    <button
                        onClick={() => {
                            setProjectType('pages');
                            setCodeSource('upload');
                            setFile(null);
                        }}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${projectType === 'pages'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">📄</div>
                        <div className="font-bold">Pages</div>
                        <div className="text-xs mt-1 opacity-80">静态网站 hosting</div>
                    </button>
                </div>
            </div>

            {/* 配置区域：根据类型不同显示不同内容 */}

            {/* 1. Worker: Editor vs Upload */}
            {projectType === 'worker' && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                        代码来源 *
                    </label>
                    <div className="flex gap-4 mb-4">
                        <button
                            onClick={() => setCodeSource('editor')}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${codeSource === 'editor'
                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                }`}
                        >
                            <div className="font-bold">✏️ 在线编写</div>
                        </button>
                        <button
                            onClick={() => setCodeSource('upload')}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${codeSource === 'upload'
                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                }`}
                        >
                            <div className="font-bold">📁 上传文件</div>
                        </button>
                    </div>

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
                            </div>
                            <div className="border-2 border-gray-700 rounded-lg overflow-hidden">
                                <Editor
                                    height="400px"
                                    language={filename.endsWith('.ts') ? 'typescript' : 'javascript'}
                                    value={code}
                                    onChange={(value) => setCode(value || '')}
                                    theme="vs-dark"
                                    options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
                                />
                            </div>
                        </div>
                    ) : (
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
                                className="block w-full px-4 py-8 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg text-center cursor-pointer hover:border-orange-500 transition-colors"
                            >
                                {file ? (
                                    <div>
                                        <div className="text-4xl mb-2">📄</div>
                                        <div className="text-white font-medium">{file.name}</div>
                                        <div className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-4xl mb-2">📁</div>
                                        <div className="text-gray-400">点击选择代码文件 (.js/.ts)</div>
                                    </div>
                                )}
                            </label>
                        </div>
                    )}
                </div>
            )}

            {/* 2. Pages: Folder vs Zip */}
            {projectType === 'pages' && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                        上传方式 *
                    </label>
                    <div className="flex gap-4 mb-4">
                        <button
                            onClick={() => setUploadType('folder')}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${uploadType === 'folder'
                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                }`}
                        >
                            <div className="font-bold">📁 上传文件夹</div>
                            <div className="text-xs opacity-75">推荐 (webkitdirectory)</div>
                        </button>
                        <button
                            onClick={() => setUploadType('zip')}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${uploadType === 'zip'
                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                }`}
                        >
                            <div className="font-bold">📦 上传 ZIP</div>
                            <div className="text-xs opacity-75">已打包好的网站</div>
                        </button>
                    </div>

                    {uploadType === 'folder' ? (
                        <div className="relative">
                            <input
                                type="file"
                                // @ts-ignore
                                webkitdirectory="" directory="" multiple
                                onChange={handleFolderSelect}
                                className="hidden"
                                id="pages-folder-upload"
                            />
                            <label
                                htmlFor="pages-folder-upload"
                                className="block w-full px-4 py-8 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg text-center cursor-pointer hover:border-orange-500 transition-colors"
                            >
                                {processing ? (
                                    <div className="animate-pulse">
                                        <div className="text-4xl mb-2">⏳</div>
                                        <div className="text-white font-medium">正在打包文件...</div>
                                    </div>
                                ) : file ? (
                                    <div>
                                        <div className="text-4xl mb-2">📦</div>
                                        <div className="text-white font-medium">已准备好上传 (自动打包为 ZIP)</div>
                                        <div className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                        <div className="text-xs text-orange-400 mt-2">点击更换文件夹</div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-4xl mb-2">📂</div>
                                        <div className="text-gray-400">点击选择网站构建目录 (如 dist)</div>
                                        <div className="text-sm text-gray-600 mt-1">浏览器将自动打包并上传</div>
                                    </div>
                                )}
                            </label>
                        </div>
                    ) : (
                        <div className="relative">
                            <input
                                type="file"
                                accept=".zip"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="hidden"
                                id="pages-zip-upload"
                            />
                            <label
                                htmlFor="pages-zip-upload"
                                className="block w-full px-4 py-8 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg text-center cursor-pointer hover:border-orange-500 transition-colors"
                            >
                                {file ? (
                                    <div>
                                        <div className="text-4xl mb-2">📦</div>
                                        <div className="text-white font-medium">{file.name}</div>
                                        <div className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-4xl mb-2">🤐</div>
                                        <div className="text-gray-400">点击选择 ZIP 压缩包</div>
                                    </div>
                                )}
                            </label>
                        </div>
                    )}
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
                    disabled={creating || processing}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold rounded-lg disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-orange-500/50"
                >
                    {creating ? '创建中...' : processing ? '打包中...' : '🚀 创建并部署'}
                </button>
            </div>
        </div>
    );
};

export default CreateWorkerForm;
