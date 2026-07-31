import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';
import { FileArchive, FolderOpen, Loader2, Upload } from 'lucide-react';

/**
 * Pages 类型项目创建表单（静态站点上传）
 * 内部管理文件夹/ZIP 上传切换、拖拽、文件打包等状态
 */
const PagesForm = forwardRef<SubFormHandle, SubFormProps>(({ setError }, ref) => {
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
            };
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
            <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                {t('pagesForm.uploadMethod')}
            </p>

            <div className="mb-4 flex gap-1 border-b border-[var(--border-color)]" role="tablist" aria-label={t('pagesForm.uploadMethod')}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={uploadType === 'folder'}
                    onClick={() => setUploadType('folder')}
                    className={uploadType === 'folder' ? 'resource-tab active' : 'resource-tab'}
                >
                    <FolderOpen size={15} aria-hidden="true" />
                    {t('pagesForm.folder')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={uploadType === 'zip'}
                    onClick={() => setUploadType('zip')}
                    className={uploadType === 'zip' ? 'resource-tab active' : 'resource-tab'}
                >
                    <FileArchive size={15} aria-hidden="true" />
                    {t('pagesForm.zip')}
                </button>
            </div>

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
                            id="pages-folder-upload"
                        />
                        <label
                            htmlFor="pages-folder-upload"
                            className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center p-6 text-center"
                        >
                            {processing ? (
                                <div className="text-center">
                                    <Loader2 size={24} className="mx-auto animate-spin text-[var(--primary)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{t('pagesForm.processing')}</div>
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
                                    <div className="mt-3 text-sm font-semibold">{t('pagesForm.selectProjectDir')}</div>
                                    <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--text-muted)]">
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
                            className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center p-6 text-center"
                        >
                            {file ? (
                                <div>
                                    <FileArchive size={24} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{file.name}</div>
                                    <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                                        {(file.size / 1024).toFixed(2)} KB
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <Upload size={24} className="mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                                    <div className="mt-3 text-sm font-semibold">{t('pagesForm.selectZip')}</div>
                                    <div className="mt-1 text-xs text-[var(--text-muted)]">{t('pagesForm.dragDrop')}</div>
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
