import React, { useState, forwardRef, useImperativeHandle } from 'react';
import JSZip from 'jszip';
import { getToken } from '../api';
import { analyzeFiles, analyzeZip } from '../utils/projectAnalyzer';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';

/**
 * Build 类型项目创建表单（源码上传 + 构建部署）
 * 内部管理源码文件、框架选择、构建配置、构建日志等全部状态
 */
const BuildForm = forwardRef<SubFormHandle, SubFormProps>(({ setError, showToast }, ref) => {
    // 文件上传状态
    const [uploadType, setUploadType] = useState<'folder' | 'zip'>('folder');
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // 构建配置状态
    const [framework, setFramework] = useState('Other');
    const [buildCommand, setBuildCommand] = useState('');
    const [deployCommand, setDeployCommand] = useState('');
    const [outputDir, setOutputDir] = useState('dist');

    // 构建执行状态
    const [buildLogs, setBuildLogs] = useState<string[]>([]);
    const [buildId, setBuildId] = useState<string | null>(null);
    const [isBuilding, setIsBuilding] = useState(false);

    // 暴露 getPayload 方法给父组件
    useImperativeHandle(ref, () => ({
        getPayload: async (): Promise<Partial<CreateProjectPayload> | null> => {
            if (!file) {
                setError('请先选择项目文件');
                return null;
            }
            if (!buildId) {
                setError('请先完成构建');
                return null;
            }
            return {
                type: 'pages',
                bindings: { kv: [], d1: [], r2: [] },
                envVars: {},
                buildId,
                outputDir,
                buildCommand,
                deployCommand,
                _file: file,
            } as any;
        },
    }));

    /** 框架预设切换 */
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

    /** 执行构建 */
    const handleBuild = async () => {
        if (!file) return setError('请先选择项目文件');

        setIsBuilding(true);
        setBuildLogs(['Starting build process...', 'Uploading files...']);
        setBuildId(null);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('buildCommand', buildCommand);
            formData.append('outputDir', outputDir);

            const token = getToken();
            const response = await fetch('/api/build', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
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
                        } catch (e) {
                            console.error(e);
                        }
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
                    // 自动分析 ZIP 内容
                    analyzeZip(droppedFile).then(analysis => {
                        if (analysis) {
                            if (analysis.detected) setFramework(analysis.framework);
                            if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
                            if (analysis.outputDir) setOutputDir(analysis.outputDir);
                            if (analysis.deployCommand) setDeployCommand(analysis.deployCommand);
                            showToast(`已自动识别: ${analysis.framework}`);
                        }
                    });
                } else {
                    setError('请拖入 ZIP 文件');
                }
            } else {
                setError('文件夹请点击选择 (浏览器限制，直接拖拽可能有兼容性问题)');
            }
        }
    };

    /** 处理源码文件夹选择 */
    const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setProcessing(true);
        setError('');

        try {
            const zip = new JSZip();
            const fileArray = Array.from(files);

            if (fileArray.length > 0) {
                const firstPathParts = fileArray[0].webkitRelativePath.split('/');

                if (firstPathParts.length > 1) {
                    const candidateRoot = firstPathParts[0] + '/';
                    const hasCommonRoot = fileArray.every(f => f.webkitRelativePath.startsWith(candidateRoot));

                    if (hasCommonRoot) {
                        fileArray.forEach(file => {
                            const cleanPath = file.webkitRelativePath.substring(candidateRoot.length);
                            if (cleanPath) {
                                zip.file(cleanPath, file);
                            }
                        });
                    } else {
                        fileArray.forEach(file => {
                            zip.file(file.webkitRelativePath, file);
                        });
                    }
                } else {
                    fileArray.forEach(file => {
                        zip.file(file.webkitRelativePath, file);
                    });
                }
            }

            // 自动识别框架
            const analysis = await analyzeFiles(fileArray);
            if (analysis) {
                if (analysis.detected) setFramework(analysis.framework);
                if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
                if (analysis.outputDir) setOutputDir(analysis.outputDir);
                if (analysis.deployCommand) setDeployCommand(analysis.deployCommand);
                showToast(`已自动识别: ${analysis.framework}`);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const zipFile = new File([content], 'project.zip', { type: 'application/zip' });
            setFile(zipFile);
        } catch (err) {
            console.error(err);
            setError('文件夹打包失败');
        } finally {
            setProcessing(false);
        }
    };

    /** 处理源码 ZIP 选择（Build 模式的拖拽区也支持 ZIP） */
    const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setFile(selected);

        const analysis = await analyzeZip(selected);
        if (analysis) {
            if (analysis.detected) setFramework(analysis.framework);
            if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
            if (analysis.outputDir) setOutputDir(analysis.outputDir);
            if (analysis.deployCommand) setDeployCommand(analysis.deployCommand);
            showToast(`已自动识别: ${analysis.framework}`);
        }
    };

    return (
        <div>
            {/* 源码上传区 */}
            <label className="block text-sm font-medium text-gray-300 mb-3">
                源码上传
            </label>

            {/* 上传方式切换 */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => { setUploadType('folder'); setFile(null); }}
                    className={`flex-1 px-4 py-3 rounded-xl border transition-all ${uploadType === 'folder'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                        : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:bg-gray-800'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">📁 上传文件夹</div>
                    <div className="text-xs opacity-75 text-center mt-1">推荐 (自动打包)</div>
                </button>
                <button
                    onClick={() => { setUploadType('zip'); setFile(null); }}
                    className={`flex-1 px-4 py-3 rounded-xl border transition-all ${uploadType === 'zip'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                        : 'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700 hover:bg-gray-800'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">📦 上传 ZIP</div>
                    <div className="text-xs opacity-75 text-center mt-1">已打包好的源码压缩包</div>
                </button>
            </div>

            {/* 拖拽上传区域 */}
            <div
                className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out group ${isDragging
                    ? 'border-orange-500 bg-orange-500/10 scale-[1.02]'
                    : 'border-gray-700 bg-gray-900/30 hover:border-gray-600 hover:bg-gray-900/50'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {uploadType === 'folder' ? (
                    <>
                        <input
                            type="file"
                            // @ts-ignore
                            webkitdirectory="" directory="" multiple
                            onChange={handleFolderSelect}
                            className="hidden"
                            id="build-folder-upload"
                        />
                        <label
                            htmlFor="build-folder-upload"
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
                                    <div className="text-gray-300 font-bold text-lg mb-2">上传源码文件夹</div>
                                    <div className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                                        包含 package.json 的项目根目录
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
                            id="build-zip-upload"
                        />
                        <label
                            htmlFor="build-zip-upload"
                            className="block w-full py-12 cursor-pointer flex flex-col items-center justify-center text-center p-6"
                        >
                            {file ? (
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
                                    <div className="text-5xl mb-4 opacity-50 group-hover:opacity-100 transition-opacity">🤐</div>
                                    <div className="text-gray-300 font-bold text-lg mb-2">点击选择源码 ZIP 压缩包</div>
                                    <div className="text-xs text-gray-500">或将 ZIP 文件拖拽至此</div>
                                </div>
                            )}
                        </label>
                    </>
                )}
            </div>

            {/* 构建配置 */}
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

                {/* 构建日志终端 */}
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
        </div>
    );
});

BuildForm.displayName = 'BuildForm';

export default BuildForm;
