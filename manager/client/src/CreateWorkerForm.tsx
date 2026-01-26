import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import JSZip from 'jszip';
import { authenticatedFetch, getToken } from './api';
import { analyzeFiles, analyzeZip } from './utils/projectAnalyzer';

interface CreateWorkerFormProps {
    onSuccess: () => void;
}

type CodeSource = 'editor' | 'upload';

const CreateWorkerForm: React.FC<CreateWorkerFormProps> = ({ onSuccess }) => {
    const [name, setName] = useState('');
    const [projectType, setProjectType] = useState<'worker' | 'pages'>('worker');
    const [codeSource, setCodeSource] = useState<CodeSource>('editor');

    // Pages Upload Type
    const [uploadType, setUploadType] = useState<'zip' | 'folder' | 'build'>('folder');

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
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Build State
    const [buildCommand, setBuildCommand] = useState('');
    const [deployCommand, setDeployCommand] = useState(''); // New State
    const [outputDir, setOutputDir] = useState('dist');
    const [framework, setFramework] = useState('Other');
    const [buildLogs, setBuildLogs] = useState<string[]>([]);
    const [buildId, setBuildId] = useState<string | null>(null);
    const [isBuilding, setIsBuilding] = useState(false);

    const handleFrameworkChange = (fw: string) => {
        setFramework(fw);
        if (fw === 'React' || fw === 'Vue') {
            setBuildCommand('npm install && npm run build');
            setOutputDir('dist');
        } else if (fw === 'Next.js (Static)') {
            setBuildCommand('npm install && npm run build');
            setOutputDir('out');
        } else {
            setBuildCommand('');
            setOutputDir('dist');
        }
    };

    // ... handleBuild (no changes needed as it uses form data constructed later? Wait, handleBuild constructs FormData)
    const handleBuild = async () => {
        // ...
        // Note: The /api/build endpoint is for PREVIEW build. It doesn't deploy.
        // So we don't send deployCommand here.
        // ... (existing handleBuild logic)
        // Oops, actually handleBuild is for the "Build & Deploy" flow initial step.
        // But the user request says "add ... to build and rebuild ... to specify command to deploy ... (e.g. npx wrangler deploy)"
        // "Build & Deploy" flow creates project with buildId.
        // It seems consistent to saving it in project creation payload.
        if (!file) return setError('请先选择项目文件');
        if (!name.trim()) return setError('项目名称不能为空');

        setIsBuilding(true);
        setBuildLogs(['Starting build process...', 'Uploading files...']);
        setBuildId(null);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('buildCommand', buildCommand);
            formData.append('outputDir', outputDir);

            // Use fetch directly for streaming support
            const token = getToken();
            const response = await fetch('/api/build', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('Failed to start stream');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'log') {
                                setBuildLogs(prev => [...prev, data.content]);
                            } else if (data.type === 'error') {
                                setError(data.content);
                                setBuildLogs(prev => [...prev, `Error: ${data.content}`]);
                            } else if (data.type === 'result') {
                                if (data.success) {
                                    setBuildId(data.buildId);
                                    setBuildLogs(prev => [...prev, 'Build Successful! You can now deploy.']);
                                }
                            }
                        } catch (e) { console.error(e); }
                    }
                }
            }

        } catch (e) {
            setError('Build failed to start');
            console.error(e);
        } finally {
            setIsBuilding(false);
        }
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles && droppedFiles.length > 0) {
            if (uploadType === 'zip') {
                const droppedFile = droppedFiles[0];
                if (droppedFile.name.endsWith('.zip')) {
                    setFile(droppedFile);
                } else {
                    setError("请拖入 ZIP 文件");
                }
            } else {
                // Folder drop support via dataTransfer is complex.
                // We guide user to click for folders to ensure webkitdirectory works.
                setError("文件夹请点击选择 (浏览器限制，直接拖拽可能有兼容性问题)");
            }
        }
    };

    const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (existing logic)
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setProcessing(true);
        setError('');

        try {
            const zip = new JSZip();

            // Check for common root folder
            const fileArray = Array.from(files);
            // ... (existing zipping logic)
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


            // Auto-Analyze
            const analysis = await analyzeFiles(fileArray);
            if (analysis) {
                if (analysis.detected) setFramework(analysis.framework);
                if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
                if (analysis.outputDir) setOutputDir(analysis.outputDir);
                if (analysis.deployCommand) setDeployCommand(analysis.deployCommand); // Auto-set deploy cmd
                showToast(`已自动识别: ${analysis.framework}`);
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

    const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFile(file);

        // Analyze
        const analysis = await analyzeZip(file);
        if (analysis) {
            if (analysis.detected) setFramework(analysis.framework);
            if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
            if (analysis.outputDir) setOutputDir(analysis.outputDir);
            if (analysis.deployCommand) setDeployCommand(analysis.deployCommand); // Auto-set deploy cmd
            showToast(`已自动识别: ${analysis.framework}`);
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('项目名称不能为空');
            return;
        }

        // Validate Name: 
        // 1. Only English letters, numbers, and hyphens
        // 2. Cannot start or end with a hyphen
        const nameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        if (!nameRegex.test(name)) {
            setError('项目名称非法：只能包含字母/数字/连字符，且不能以连字符开头或结尾');
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
                    bindings: { kv: [], d1: [], r2: [] },
                    envVars: {}
                };

                const res = await authenticatedFetch('/api/projects', {
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

                const uploadRes = await authenticatedFetch('/api/upload', {
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
                    bindings: { kv: [], d1: [], r2: [] },
                    envVars: {},
                    buildId: buildId || undefined, // Send buildId if exists
                    outputDir: buildId ? outputDir : undefined, // Inform server of output subpath
                    buildCommand: buildId ? buildCommand : undefined, // Persist build command
                    deployCommand: buildId ? deployCommand : undefined // Persist deploy command
                };

                const res = await authenticatedFetch('/api/projects', {
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
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg text-white font-medium animate-fade-in-down z-[70] ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                    {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
                </div>
            )}

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
                    项目名称 * <span className="text-xs text-gray-500 font-normal ml-2">(字母/数字/连字符，不能以连字符开头结尾)</span>
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
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${projectType === 'pages' && uploadType !== 'build'
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="text-2xl mb-2">📄</div>
                        <div className="font-bold">Pages</div>
                        <div className="text-xs mt-1 opacity-80">静态网站 hosting</div>
                    </button>

                    <button
                        onClick={() => {
                            setProjectType('pages');
                            setUploadType('build');
                            setFile(null);
                        }}
                        className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${uploadType === 'build'
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

            {/* 2. Pages: Folder vs Zip vs Build */}
            {projectType === 'pages' && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                        {uploadType === 'build' ? '源码上传' : '上传方式 *'}
                    </label>

                    {uploadType !== 'build' && (
                        <div className="flex gap-4 mb-6">
                            <button
                                onClick={() => setUploadType('folder')}
                                className={`flex-1 px-4 py-3 rounded-xl border transition-all ${uploadType === 'folder'
                                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                                    : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:bg-gray-800'
                                    }`}
                            >
                                <div className="font-bold flex items-center justify-center gap-2">📁 上传文件夹</div>
                                <div className="text-xs opacity-75 text-center mt-1">推荐 (自动打包)</div>
                            </button>
                            <button
                                onClick={() => setUploadType('zip')}
                                className={`flex-1 px-4 py-3 rounded-xl border transition-all ${uploadType === 'zip'
                                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                                    : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:bg-gray-800'
                                    }`}
                            >
                                <div className="font-bold flex items-center justify-center gap-2">📦 上传 ZIP</div>
                                <div className="text-xs opacity-75 text-center mt-1">已打包好的压缩包</div>
                            </button>
                        </div>
                    )}

                    {/* Integrated Drop Zone */}
                    <div
                        className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out group ${isDragging
                            ? 'border-orange-500 bg-orange-500/10 scale-[1.02]'
                            : 'border-gray-700 bg-gray-900/30 hover:border-gray-600 hover:bg-gray-900/50'
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {/* Re-use folder/zip logic but adapt text for 'build' */}
                        {uploadType === 'folder' || uploadType === 'build' ? (
                            <>
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
                                    className="block w-full py-12 cursor-pointer flex flex-col items-center justify-center text-center p-6"
                                >
                                    {processing ? (
                                        <div className="animate-pulse">
                                            <div className="text-5xl mb-4 opacity-80">⏳</div>
                                            <div className="text-white font-bold text-lg">正在打包文件...</div>
                                        </div>
                                    ) : file ? (
                                        <div>
                                            <div className="text-5xl mb-4 text-green-400 drop-shadow-lg">📦</div>
                                            <div className="text-white font-bold text-lg mb-1">{file.name} (Ready)</div>
                                            <div className="text-sm text-gray-500 font-mono bg-gray-800/50 px-3 py-1 rounded-full inline-block mb-3">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                            </div>
                                            <div className="text-xs text-orange-400 animate-pulse">点击更换</div>
                                        </div>
                                    ) : (
                                        <div className="group-hover:scale-105 transition-transform duration-300">
                                            <div className="text-5xl mb-4 opacity-50 group-hover:opacity-100 group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">📂</div>
                                            <div className="text-gray-300 font-bold text-lg mb-2">{uploadType === 'build' ? '上传源码文件夹' : '点击选择构建产物目录'}</div>
                                            <div className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                                                {uploadType === 'build' ? '包含 package.json 的项目根目录' : '请上传包含 index.html 的文件夹 (dist/build)'}
                                            </div>
                                        </div>
                                    )}
                                </label>
                            </>
                        ) : (
                            <>
                                <input
                                    type="file"
                                    accept=".zip"
                                    onChange={handleZipSelect}
                                    className="hidden"
                                    id="pages-zip-upload"
                                />
                                <label
                                    htmlFor="pages-zip-upload"
                                    className="block w-full py-12 cursor-pointer flex flex-col items-center justify-center text-center p-6"
                                >
                                    {file ? (
                                        <div>
                                            <div className="text-5xl mb-4 text-orange-400">📦</div>
                                            <div className="text-white font-bold text-lg">{file.name}</div>
                                            <div className="text-sm text-gray-500 mt-2 font-mono">{(file.size / 1024).toFixed(2)} KB</div>
                                        </div>
                                    ) : (
                                        <div className="group-hover:scale-105 transition-transform duration-300">
                                            <div className="text-5xl mb-4 opacity-50 group-hover:opacity-100 transition-opacity">🤐</div>
                                            <div className="text-gray-300 font-bold text-lg mb-2">点击选择 ZIP 压缩包</div>
                                            <div className="text-xs text-gray-500">或将文件拖拽至此</div>
                                        </div>
                                    )}
                                </label>
                            </>
                        )}
                    </div>

                    {/* Build Configuration UI */}
                    {uploadType === 'build' && (
                        <div className="mt-8 space-y-6 border-t border-gray-800 pt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                🛠️ 构建配置
                            </h3>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">框架预设</label>
                                    <select
                                        value={framework}
                                        onChange={e => handleFrameworkChange(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="Other">Other / Custom</option>
                                        <option value="React">React / Vite</option>
                                        <option value="Vue">Vue / Vite</option>
                                        <option value="Next.js (Static)">Next.js (Static Export)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">输出目录</label>
                                    <input
                                        type="text"
                                        value={outputDir}
                                        onChange={e => setOutputDir(e.target.value)}
                                        placeholder="dist"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">构建命令 (Build Command)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
                                    <input
                                        type="text"
                                        value={buildCommand}
                                        onChange={e => setBuildCommand(e.target.value)}
                                        placeholder="npm install && npm run build"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white font-mono text-sm outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">部署命令 (Deploy Command, Optional)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
                                    <input
                                        type="text"
                                        value={deployCommand}
                                        onChange={e => setDeployCommand(e.target.value)}
                                        placeholder="npx wrangler deploy --dry-run"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white font-mono text-sm outline-none focus:border-orange-500"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">此命令将在构建成功后自动执行 (例如推送到远程或执行后置脚本)</p>
                            </div>

                            {/* Logs Terminal */}
                            <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden font-mono text-xs">
                                <div className="flex justify-between items-center bg-gray-900 px-4 py-2 border-b border-gray-800">
                                    <span className="text-gray-400">构建日志</span>
                                    {isBuilding && <span className="text-orange-400 animate-pulse">● Running...</span>}
                                    {buildId && <span className="text-green-400">● Build Success</span>}
                                </div>
                                <div className="h-48 overflow-y-auto p-4 space-y-1">
                                    {buildLogs.length === 0 ? (
                                        <div className="text-gray-600 italic">等待开始构建...</div>
                                    ) : (
                                        buildLogs.map((log, i) => (
                                            <div key={i} className="text-gray-300 break-all">{log}</div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <button
                                    onClick={handleBuild}
                                    disabled={isBuilding || !file}
                                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg border border-gray-700 hover:border-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isBuilding ? '构建中...' : (buildId ? '重新构建' : '▶ 开始构建')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )
            }

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
            {
                error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )
            }

            {/* 创建按钮 */}
            <div className="flex gap-3 pt-4">
                <button
                    onClick={handleCreate}
                    disabled={creating || processing || (uploadType === 'build' && !buildId)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold rounded-lg disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-orange-500/50"
                >
                    {creating ? '创建中...' : processing ? '打包中...' : (uploadType === 'build' && !buildId ? '请先构建' : '🚀 创建并部署')}
                </button>
            </div>
        </div >
    );
};

export default CreateWorkerForm;
