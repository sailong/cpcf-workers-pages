import React, { useState, forwardRef, useImperativeHandle } from 'react';
import JSZip from 'jszip';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';

/**
 * Pages 类型项目创建表单（静态站点上传）
 * 内部管理文件夹/ZIP 上传切换、拖拽、文件打包等状态
 */
const PagesForm = forwardRef<SubFormHandle, SubFormProps>(({ setError, showToast }, ref) => {
    const [uploadType, setUploadType] = useState<'folder' | 'zip'>('folder');
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // 暴露 getPayload 方法给父组件
    useImperativeHandle(ref, () => ({
        getPayload: async (): Promise<Partial<CreateProjectPayload> | null> => {
            if (!file) {
                setError('请选择文件');
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
                    setError('请拖入 ZIP 文件');
                }
            } else {
                // 浏览器限制，文件夹拖拽兼容性问题
                setError('文件夹请点击选择 (浏览器限制，直接拖拽可能有兼容性问题)');
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
            setError('文件夹打包失败');
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
            <label className="block text-sm font-medium text-gray-300 mb-3">
                上传方式 *
            </label>

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
                                    <div className="text-gray-300 font-bold text-lg mb-2">点击选择构建产物目录</div>
                                    <div className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                                        请上传包含 index.html 的文件夹 (dist/build)
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
        </div>
    );
});

PagesForm.displayName = 'PagesForm';

export default PagesForm;
