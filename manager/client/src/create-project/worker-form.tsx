import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '../components/IDE/Editor';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';
import { FileCode2, Upload } from 'lucide-react';

type CodeSource = 'editor' | 'upload';

/**
 * Worker 类型项目创建表单
 * 内部管理编辑器/上传切换、代码内容、文件等状态
 */
const WorkerForm = forwardRef<SubFormHandle, SubFormProps>(({ setError }, ref) => {
    const { t } = useTranslation();
    const [codeSource, setCodeSource] = useState<CodeSource>('editor');
    const [code, setCode] = useState(`export default {
  async fetch(request, env, ctx) {
    return new Response("Hello World!");
  }
}`);
    const [filename, setFilename] = useState('worker.js');
    const [file, setFile] = useState<File | null>(null);

    // 暴露 getPayload 方法给父组件
    useImperativeHandle(ref, () => ({
        getPayload: async (): Promise<Partial<CreateProjectPayload> | null> => {
            if (codeSource === 'editor') {
                if (!code.trim()) {
                    setError(t('workerForm.codeEmpty'));
                    return null;
                }
                if (!filename.trim()) {
                    setError(t('workerForm.filenameEmpty'));
                    return null;
                }
                return {
                    type: 'worker',
                    code,
                    filename,
                    bindings: { kv: [], d1: [], r2: [] },
                    envVars: {},
                };
            } else {
                // 上传模式
                if (!file) {
                    setError(t('workerForm.fileEmpty'));
                    return null;
                }
                // 需要先上传文件，但上传逻辑在父组件统一处理
                return {
                    type: 'worker',
                    bindings: { kv: [], d1: [], r2: [] },
                    envVars: {},
                    _file: file, // 临时字段，父组件处理上传
                };
            }
        },
    }));

    return (
        <div>
            <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                {t('workerForm.codeSource')}
            </p>
            <div className="mb-4 flex gap-1 border-b border-[var(--border-color)]" role="tablist" aria-label={t('workerForm.codeSource')}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={codeSource === 'editor'}
                    onClick={() => setCodeSource('editor')}
                    className={codeSource === 'editor' ? 'resource-tab active' : 'resource-tab'}
                >
                    <FileCode2 size={15} aria-hidden="true" />
                    {t('workerForm.editor')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={codeSource === 'upload'}
                    onClick={() => setCodeSource('upload')}
                    className={codeSource === 'upload' ? 'resource-tab active' : 'resource-tab'}
                >
                    <Upload size={15} aria-hidden="true" />
                    {t('workerForm.upload')}
                </button>
            </div>

            {codeSource === 'editor' ? (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="worker-filename" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                            {t('workerForm.filename')}
                        </label>
                        <input
                            id="worker-filename"
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            placeholder="worker.js"
                            className="console-input w-full font-mono"
                        />
                    </div>
                    <div className="overflow-hidden rounded-md border border-[var(--border-color)]">
                        <Editor
                            height="360px"
                            language={filename.endsWith('.ts') ? 'typescript' : 'javascript'}
                            code={code}
                            onChange={(value) => setCode(value || '')}
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
                        className={`flex min-h-40 w-full cursor-pointer items-center justify-center rounded-md border border-dashed px-4 py-8 text-center transition-colors ${file
                            ? 'border-[var(--primary)] bg-[var(--color-primary-light)]'
                            : 'border-[var(--border-color)] bg-[var(--bg-subtle)] hover:border-[var(--border-color-hover)]'
                            }`}
                    >
                        {file ? (
                            <div>
                                <FileCode2 size={24} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
                                <div className="mt-3 text-sm font-semibold">{file.name}</div>
                                <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                                    {(file.size / 1024).toFixed(2)} KB
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Upload size={24} className="mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                                <div className="mt-3 text-sm font-semibold">{t('workerForm.selectFile')}</div>
                                <div className="mt-1 text-xs text-[var(--text-muted)]">{t('workerForm.fileSupport')}</div>
                            </div>
                        )}
                    </label>
                </div>
            )}
        </div>
    );
});

WorkerForm.displayName = 'WorkerForm';

export default WorkerForm;
