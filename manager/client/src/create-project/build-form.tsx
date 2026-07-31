import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { analyzeFiles, analyzeZip } from '../utils/projectAnalyzer';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';
import { FileArchive, FolderOpen, Hammer, Loader2, Terminal, Upload } from 'lucide-react';
import { consumeSSE } from '../utils/sse-stream';

/**
 * Build 类型项目创建表单（源码上传 + 构建部署）
 * 内部管理源码文件、框架选择、构建配置、构建日志等全部状态
 */
const BuildForm = forwardRef<SubFormHandle, SubFormProps>(({ setError, showToast, limits }, ref) => {
    const { t } = useTranslation();
    // 文件上传状态
    const [uploadType, setUploadType] = useState<'folder' | 'zip'>('folder');
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // 构建配置状态
    const [framework, setFramework] = useState('Other');
    const [buildCommand, setBuildCommand] = useState('');
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
                _file: file,
            };
        },
    }));

    /** 框架预设切换 */
    const handleFrameworkChange = (fw: string) => {
        setFramework(fw);
        if (fw === 'React' || fw === 'Vue') {
            setBuildCommand('npm ci && npm run build');
            setOutputDir('dist');
        } else if (fw === 'Next.js (Static)') {
            setBuildCommand('npm ci && npm run build');
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
            if (limits) formData.append('limits', JSON.stringify(limits));

            const response = await fetch('/api/build', {
                method: 'POST',
                credentials: 'same-origin',
                headers: limits?.uploadMb ? { 'X-Project-Upload-Limit-Mb': String(limits.uploadMb) } : undefined,
                body: formData,
            });

            await consumeSSE(response, data => {
                if (data.type === 'log') {
                    setBuildLogs(prev => [...prev, String(data.content || '')]);
                    return false;
                }
                if (data.type === 'error') {
                    const message = String(data.content || t('buildForm.buildStartFail'));
                    setError(message);
                    setBuildLogs(prev => [...prev, `错误: ${message}`]);
                    return true;
                }
                if (data.type === 'result') {
                    if (data.success && typeof data.buildId === 'string') {
                        setBuildId(data.buildId);
                        setBuildLogs(prev => [...prev, t('buildForm.buildSuccess')]);
                    } else if (!data.success) {
                        setError(t('buildForm.buildStartFail'));
                    }
                    return true;
                }
                return false;
            });
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
                showToast(t('buildForm.autoDetected', { framework: analysis.framework }));
            }
    };

    return (
        <div>
            {/* 源码上传区 */}
            <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                {t('buildForm.sourceUpload')}
            </p>

            {/* 上传方式切换 */}
            <div className="mb-4 flex gap-1 border-b border-[var(--border-color)]" role="tablist" aria-label={t('buildForm.sourceUpload')}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={uploadType === 'folder'}
                    onClick={() => { setUploadType('folder'); setFile(null); }}
                    className={uploadType === 'folder' ? 'resource-tab active' : 'resource-tab'}
                >
                    <FolderOpen size={15} aria-hidden="true" />
                    {t('buildForm.folder')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={uploadType === 'zip'}
                    onClick={() => { setUploadType('zip'); setFile(null); }}
                    className={uploadType === 'zip' ? 'resource-tab active' : 'resource-tab'}
                >
                    <FileArchive size={15} aria-hidden="true" />
                    {t('buildForm.zip')}
                </button>
            </div>

            {/* 拖拽上传区域 */}
            <div
                className={`relative overflow-hidden rounded-md border border-dashed transition-colors ${isDragging
                    ? 'border-[var(--primary)] bg-[var(--color-primary-light)]'
                    : file
                        ? 'border-[var(--primary)] bg-[var(--color-primary-light)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-subtle)] hover:border-[var(--border-color-hover)]'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {uploadType === 'folder' ? (
                    <>
                        <input
                            type="file"
                            {...{ webkitdirectory: '', directory: '' }} multiple
                            onChange={handleFolderSelect}
                            className="hidden"
                            id="build-folder-upload"
                        />
                        <label
                            htmlFor="build-folder-upload"
                            className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center p-6 text-center"
                        >
                            {processing ? (
                                <div className="text-center">
                                    <Loader2 size={24} className="mx-auto animate-spin text-[var(--primary)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{t('buildForm.processing')}</div>
                                </div>
                            ) : file ? (
                                <div>
                                    <FileArchive size={24} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{file.name}</div>
                                    <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <FolderOpen size={24} className="mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{t('buildForm.uploadSourceFolder')}</div>
                                    <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--text-muted)]">
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
                            className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center p-6 text-center"
                        >
                            {file ? (
                                <div>
                                    <FileArchive size={24} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{file.name}</div>
                                    <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <Upload size={24} className="mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{t('buildForm.uploadSourceZip')}</div>
                                    <div className="mt-1 text-xs text-[var(--text-muted)]">{t('buildForm.uploadSourceZipDesc')}</div>
                                </div>
                            )}
                        </label>
                    </>
                )}
            </div>

            {/* 构建配置 */}
            <div className="mt-6 space-y-5 border-t border-[var(--border-color)] pt-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Hammer size={16} className="text-[var(--primary)]" aria-hidden="true" /> {t('buildForm.buildConfig')}
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="block text-[var(--text-muted)] text-[10px] font-bold uppercase mb-2 ml-1 tracking-[0.2em]">{t('buildForm.frameworkPreset')}</label>
                        <select
                            value={framework}
                            onChange={e => handleFrameworkChange(e.target.value)}
                            className="console-input w-full appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 1)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                        >
                            <option value="Other">Other / Custom</option>
                            <option value="React">React / Vite</option>
                            <option value="Vue">Vue / Vite</option>
                            <option value="Next.js (Static)">Next.js (Static Export)</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('buildForm.outputDir')}</label>
                        <input
                            type="text"
                            value={outputDir}
                            onChange={e => setOutputDir(e.target.value)}
                            placeholder="dist"
                            className="console-input w-full"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('buildForm.buildCommand')}</label>
                    <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50 font-mono text-sm group-focus-within:text-blue-400 transition-colors">$</span>
                        <input
                            type="text"
                            value={buildCommand}
                            onChange={e => setBuildCommand(e.target.value)}
                            placeholder="npm ci && npm run build"
                            className="console-input w-full pl-8 font-mono"
                        />
                    </div>
                </div>

                {/* 构建日志控制台 */}
                <div className="overflow-hidden rounded-md border border-[var(--border-color)] font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-subtle)] px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <Terminal size={15} aria-hidden="true" />
                            <span className="font-medium text-[var(--text-muted)]">{t('buildForm.logsTerminal')}</span>
                        </div>
                        {isBuilding && <span className="text-blue-500 animate-pulse flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> {t('buildForm.running')}</span>}
                        {buildId && <span className="text-green-500 flex items-center gap-2">{t('buildForm.success')}</span>}
                    </div>
                    <div className="h-60 overflow-y-auto p-5 space-y-1.5 bg-[var(--bg-base)] text-[var(--text-muted)]">
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
                    <button type="button"
                        onClick={handleBuild}
                        disabled={isBuilding || !file}
                        className={`console-button w-full ${buildId ? 'secondary' : 'primary'}`}
                    >
                        {isBuilding && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
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
