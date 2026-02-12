import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';

/**
 * Pages 类型项目创建表单（静态站点上传）
 * 内部管理文件夹/ZIP 上传切换、拖拽、文件打包等状态
 */
const PagesForm = forwardRef<SubFormHandle, SubFormProps>(({ setError, showToast }, ref) => {
    const { t } = useTranslation();
    const [uploadType, setUploadType] = useState<'folder' | 'zip'>('folder');
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // 暴露 getPayload 方法给父组件
    useImperativeHandle(ref, () => ({
        getPayload: async (): Promise<Partial<CreateProjectPayload> | null> => {
            if (!file) {
                setError(t('workerForm.fileEmpty'));
                return null;
            }
            return {
                type: 'pages',
                bindings: { kv: [], d1: [], r2: [] },
                envVars: {},
                _file: file,
            } as any;
        },
    }));

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
                    setError(t('pagesForm.zipError'));
                }
            } else {
                // 浏览器限制，文件夹拖拽兼容性问题
                setError(t('pagesForm.folderCompat'));
            }
        }
    };

    /** 处理文件夹选择：将文件夹内容打包为 ZIP */
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

                // 检查是否有公共根目录，有则去除
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

    /** 处理 ZIP 文件选择 */
    const handleZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setFile(selected);
    };

    return (
        <div>
            <label className="block text-gray-500 text-xs font-bold uppercase mb-4 ml-1 tracking-widest">
                {t('pagesForm.uploadMethod')}
            </label>

            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setUploadType('folder')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${uploadType === 'folder'
                        ? 'border-blue-500/50 bg-blue-500/10 dark:text-white text-blue-700 shadow-lg shadow-blue-500/10'
                        : 'border-transparent glass hover:bg-current/5 opacity-60'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">📁 {t('pagesForm.folder')}</div>
                    <div className="text-[10px] opacity-40 text-center mt-1 uppercase tracking-widest">{t('pagesForm.folderDesc')}</div>
                </button>
                <button
                    onClick={() => setUploadType('zip')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${uploadType === 'zip'
                        ? 'border-blue-500/50 bg-blue-500/10 dark:text-white text-blue-700 shadow-lg shadow-blue-500/10'
                        : 'border-transparent glass hover:bg-current/5 opacity-60'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">📦 {t('pagesForm.zip')}</div>
                    <div className="text-[10px] opacity-40 text-center mt-1 uppercase tracking-widest">{t('pagesForm.zipDesc')}</div>
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
                            id="pages-folder-upload"
                        />
                        <label
                            htmlFor="pages-folder-upload"
                            className="block w-full py-16 cursor-pointer flex flex-col items-center justify-center text-center p-6"
                        >
                            {processing ? (
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <div className="font-bold text-lg">{t('pagesForm.processing')}</div>
                                </div>
                            ) : file ? (
                                <div className="animate-in fade-in zoom-in duration-300">
                                    <div className="text-6xl mb-4 drop-shadow-2xl">📦</div>
                                    <div className="font-bold text-xl mb-1">{file.name}</div>
                                    <div className="text-xs text-blue-500 bg-blue-500/10 px-4 py-1.5 rounded-full inline-block font-mono mb-4">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                    <div className="text-xs opacity-40 group-hover:text-blue-500 transition-colors">{t('workerForm.selectFile')}</div>
                                </div>
                            ) : (
                                <div className="transition-transform duration-300 group-hover:scale-105">
                                    <div className="text-6xl mb-4 opacity-30 group-hover:opacity-100 group-hover:drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">📂</div>
                                    <div className="font-bold text-xl mb-2 opacity-60">{t('pagesForm.selectProjectDir')}</div>
                                    <div className="text-sm opacity-40 max-w-xs mx-auto leading-relaxed">
                                        {t('pagesForm.uploadDist')}
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
                            className="block w-full py-16 cursor-pointer flex flex-col items-center justify-center text-center p-6"
                        >
                            {file ? (
                                <div className="animate-in fade-in zoom-in duration-300">
                                    <div className="text-6xl mb-4 drop-shadow-2xl">📦</div>
                                    <div className="font-bold text-xl mb-1 text-center">{file.name}</div>
                                    <div className="text-xs text-blue-500 bg-blue-500/10 px-4 py-1.5 rounded-full inline-block font-mono mb-4">
                                        {(file.size / 1024).toFixed(2)} KB
                                    </div>
                                    <div className="text-xs opacity-40 group-hover:text-blue-500 transition-colors">{t('workerForm.selectFile')}</div>
                                </div>
                            ) : (
                                <div className="transition-transform duration-300 group-hover:scale-105">
                                    <div className="text-6xl mb-4 opacity-30 group-hover:opacity-100 transition-opacity">🤐</div>
                                    <div className="font-bold text-xl mb-2 opacity-60">{t('pagesForm.selectZip')}</div>
                                    <div className="text-sm opacity-40">{t('pagesForm.dragDrop')}</div>
                                </div>
                            )}
                        </label>
                    </>
                )}
            </div>
        </div>
    );
});

PagesForm.displayName = 'PagesForm';

export default PagesForm;
