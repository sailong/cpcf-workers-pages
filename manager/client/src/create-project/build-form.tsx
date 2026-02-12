import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { getToken } from '../api';
import { analyzeFiles, analyzeZip } from '../utils/projectAnalyzer';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';

/**
 * Build 类型项目创建表单（源码上传 + 构建部署）
 * 内部管理源码文件、框架选择、构建配置、构建日志等全部状态
 */
const BuildForm = forwardRef<SubFormHandle, SubFormProps>(({ setError, showToast }, ref) => {
    const { t } = useTranslation();
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
                setError(t('buildForm.selectFileFirst'));
                return null;
            }
            if (!buildId) {
                setError(t('buildForm.buildFirst'));
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
        if (!file) return setError(t('buildForm.selectFileFirst'));

        setIsBuilding(true);
        setBuildLogs([t('buildForm.building'), t('pagesForm.processing')]);
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
                                setBuildLogs(prev => [...prev, `错误: ${data.content}`]);
                            } else if (data.type === 'result') {
                                if (data.success) {
                                    setBuildId(data.buildId);
                                    setBuildLogs(prev => [...prev, t('buildForm.buildSuccess')]);
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
        } catch (e) {
            setError(t('buildForm.buildStartFail'));
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
                            showToast(t('buildForm.autoDetected', { framework: analysis.framework }));
                        }
                    });
                } else {
                    setError(t('pagesForm.zipError'));
                }
            } else {
                setError(t('pagesForm.folderCompat'));
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
                showToast(t('buildForm.autoDetected', { framework: analysis.framework }));
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const zipFile = new File([content], 'project.zip', { type: 'application/zip' });
            setFile(zipFile);
        } catch (err) {
            console.error(err);
            setError(t('pagesForm.packError'));
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
            if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
            if (analysis.outputDir) setOutputDir(analysis.outputDir);
            if (analysis.deployCommand) setDeployCommand(analysis.deployCommand);
            showToast(t('buildForm.autoDetected', { framework: analysis.framework }));
        }
    };

    return (
        <div>
            {/* 源码上传区 */}
            <label className="block text-gray-500 text-xs font-bold uppercase mb-4 ml-1 tracking-widest">
                {t('buildForm.sourceUpload')}
            </label>

            {/* 上传方式切换 */}
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => { setUploadType('folder'); setFile(null); }}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${uploadType === 'folder'
                        ? 'border-blue-500/50 bg-blue-500/10 dark:text-white text-blue-700 shadow-lg shadow-blue-500/10'
                        : 'border-transparent glass hover:bg-current/5 opacity-60'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">📁 {t('buildForm.folder')}</div>
                    <div className="text-[10px] opacity-40 text-center mt-1 uppercase tracking-widest">{t('buildForm.folderDesc')}</div>
                </button>
                <button
                    onClick={() => { setUploadType('zip'); setFile(null); }}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${uploadType === 'zip'
                        ? 'border-blue-500/50 bg-blue-500/10 dark:text-white text-blue-700 shadow-lg shadow-blue-500/10'
                        : 'border-transparent glass hover:bg-current/5 opacity-60'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">📦 {t('buildForm.zip')}</div>
                    <div className="text-[10px] opacity-40 text-center mt-1 uppercase tracking-widest">{t('buildForm.zipDesc')}</div>
                </button>
            </div>

            {/* 拖拽上传区域 */}
            <div
                className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out group overflow-hidden ${isDragging
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                    : file
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-current/10 glass hover:border-blue-500/30'
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
                            className="block w-full py-16 cursor-pointer flex flex-col items-center justify-center text-center p-6"
                        >
                            {processing ? (
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <div className="font-bold text-lg">{t('buildForm.processing')}</div>
                                </div>
                            ) : file ? (
                                <div className="animate-in fade-in zoom-in duration-300">
                                    <div className="text-6xl mb-4 drop-shadow-2xl">📦</div>
                                    <div className="font-bold text-xl mb-1">{file.name}</div>
                                    <div className="text-xs text-blue-500 bg-blue-500/10 px-4 py-1.5 rounded-full inline-block font-mono mb-4">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                    <div className="text-xs opacity-40 group-hover:text-blue-500 transition-colors">点击更换源码目录</div>
                                </div>
                            ) : (
                                <div className="transition-transform duration-300 group-hover:scale-105">
                                    <div className="text-6xl mb-4 opacity-30 group-hover:opacity-100 group-hover:drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">📂</div>
                                    <div className="font-bold text-xl mb-2 opacity-60">{t('buildForm.uploadSourceFolder')}</div>
                                    <div className="text-sm opacity-40 max-w-xs mx-auto leading-relaxed">
                                        {t('buildForm.uploadSourceFolderDesc')}
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
                            className="block w-full py-16 cursor-pointer flex flex-col items-center justify-center text-center p-6"
                        >
                            {file ? (
                                <div className="animate-in fade-in zoom-in duration-300">
                                    <div className="text-6xl mb-4 drop-shadow-2xl">📦</div>
                                    <div className="text-white font-bold text-xl mb-1">{file.name}</div>
                                    <div className="text-xs text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-full inline-block font-mono mb-4">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                    <div className="text-xs text-gray-500 group-hover:text-blue-400 transition-colors">点击更换 ZIP 文件</div>
                                </div>
                            ) : (
                                <div className="transition-transform duration-300 group-hover:scale-105">
                                    <div className="text-6xl mb-4 opacity-30 group-hover:opacity-100 transition-opacity">🤐</div>
                                    <div className="text-gray-300 font-bold text-xl mb-2">{t('buildForm.uploadSourceZip')}</div>
                                    <div className="text-sm text-gray-500">{t('buildForm.uploadSourceZipDesc')}</div>
                                </div>
                            )}
                        </label>
                    </>
                )}
            </div>

            {/* 构建配置 */}
            <div className="mt-12 space-y-8 border-t border-current/5 pt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <span className="text-2xl">🛠️</span> {t('buildForm.buildConfig')}
                </h3>

                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-gray-500 text-[10px] font-bold uppercase mb-2 ml-1 tracking-[0.2em]">{t('buildForm.frameworkPreset')}</label>
                        <select
                            value={framework}
                            onChange={e => handleFrameworkChange(e.target.value)}
                            className="neo-input w-full p-3.5 appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 1)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                        >
                            <option value="Other">Other / Custom</option>
                            <option value="React">React / Vite</option>
                            <option value="Vue">Vue / Vite</option>
                            <option value="Next.js (Static)">Next.js (Static Export)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-500 text-[10px] font-bold uppercase mb-2 ml-1 tracking-[0.2em]">{t('buildForm.outputDir')}</label>
                        <input
                            type="text"
                            value={outputDir}
                            onChange={e => setOutputDir(e.target.value)}
                            placeholder="dist"
                            className="neo-input w-full p-3.5"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-gray-500 text-[10px] font-bold uppercase mb-2 ml-1 tracking-[0.2em]">{t('buildForm.buildCommand')}</label>
                    <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50 font-mono text-sm group-focus-within:text-blue-400 transition-colors">$</span>
                        <input
                            type="text"
                            value={buildCommand}
                            onChange={e => setBuildCommand(e.target.value)}
                            placeholder="npm install && npm run build"
                            className="neo-input w-full pl-8 pr-4 py-4 font-mono text-sm"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-gray-500 text-[10px] font-bold uppercase mb-2 ml-1 tracking-[0.2em]">{t('buildForm.deployCommand')}</label>
                    <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50 font-mono text-sm group-focus-within:text-blue-400 transition-colors">$</span>
                        <input
                            type="text"
                            value={deployCommand}
                            onChange={e => setDeployCommand(e.target.value)}
                            placeholder="npx wrangler deploy --dry-run"
                            className="neo-input w-full pl-8 pr-4 py-4 font-mono text-sm"
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 ml-1 italic opacity-60">{t('buildForm.deployCommandHint')}</p>
                </div>

                {/* 构建日志控制台 */}
                <div className="glass rounded-2xl overflow-hidden font-mono text-xs border border-current/5 shadow-2xl">
                    <div className="flex justify-between items-center glass px-5 py-3 border-0 border-b">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                            </div>
                            <span className="opacity-40 ml-2 font-bold tracking-tight">{t('buildForm.logsTerminal')}</span>
                        </div>
                        {isBuilding && <span className="text-blue-500 animate-pulse flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> {t('buildForm.running')}</span>}
                        {buildId && <span className="text-green-500 flex items-center gap-2">{t('buildForm.success')}</span>}
                    </div>
                    <div className="h-60 overflow-y-auto p-5 space-y-1.5 bg-black/5">
                        {buildLogs.length === 0 ? (
                            <div className="opacity-30 italic">{t('buildForm.waitingLogs')}</div>
                        ) : (
                            buildLogs.map((log, i) => (
                                <div key={i} className="opacity-70 break-all leading-relaxed whitespace-pre-wrap"><span className="opacity-20 mr-2">{i + 1}</span>{log}</div>
                            ))
                        )}
                        <div id="build-logs-end" />
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleBuild}
                        disabled={isBuilding || !file}
                        className={`w-full py-4 text-lg font-bold rounded-xl transition-all shadow-xl active:scale-[0.98] ${buildId
                            ? 'bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20'
                            : 'btn-primary'
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                        {isBuilding ? t('buildForm.building') : (buildId ? t('buildForm.reBuild') : t('buildForm.startBuild'))}
                    </button>
                    {!buildId && file && !isBuilding && <p className="text-[10px] text-blue-500 opacity-60 text-center mt-3 animate-bounce">{t('buildForm.buildFirst')}</p>}
                </div>
            </div>
        </div>
    );
});

BuildForm.displayName = 'BuildForm';

export default BuildForm;
