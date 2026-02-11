import React, { useState, forwardRef, useImperativeHandle } from 'react';
import Editor from '../components/IDE/Editor';
import type { SubFormHandle, SubFormProps, CreateProjectPayload } from './types';

type CodeSource = 'editor' | 'upload';

/**
 * Worker 类型项目创建表单
 * 内部管理编辑器/上传切换、代码内容、文件等状态
 */
const WorkerForm = forwardRef<SubFormHandle, SubFormProps>(({ setError }, ref) => {
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
                    setError('代码不能为空');
                    return null;
                }
                if (!filename.trim()) {
                    setError('文件名不能为空');
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
                    setError('请选择文件');
                    return null;
                }
                // 需要先上传文件，但上传逻辑在父组件统一处理
                return {
                    type: 'worker',
                    bindings: { kv: [], d1: [], r2: [] },
                    envVars: {},
                    _file: file, // 临时字段，父组件处理上传
                } as any;
            }
        },
    }));

    return (
        <div>
            <label className="block text-gray-500 text-xs font-bold uppercase mb-4 ml-1 tracking-widest">
                代码来源 *
            </label>
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setCodeSource('editor')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${codeSource === 'editor'
                        ? 'border-blue-500/50 bg-blue-500/10 dark:text-white text-blue-700 shadow-lg shadow-blue-500/10'
                        : 'border-transparent glass hover:bg-current/5 opacity-60'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">✏️ 在线编写</div>
                </button>
                <button
                    onClick={() => setCodeSource('upload')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${codeSource === 'upload'
                        ? 'border-blue-500/50 bg-blue-500/10 dark:text-white text-blue-700 shadow-lg shadow-blue-500/10'
                        : 'border-transparent glass hover:bg-current/5 opacity-60'
                        }`}
                >
                    <div className="font-bold flex items-center justify-center gap-2">📁 上传文件</div>
                </button>
            </div>

            {codeSource === 'editor' ? (
                <div className="space-y-6">
                    <div>
                        <label className="block text-gray-500 text-xs font-bold uppercase mb-2 ml-1 tracking-widest">
                            文件名 *
                        </label>
                        <input
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            placeholder="worker.js"
                            className="input-liquid w-full p-4 font-mono"
                        />
                    </div>
                    <div className="border border-current/10 rounded-2xl overflow-hidden glass shadow-2xl">
                        <Editor
                            height="400px"
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
                        className={`block w-full px-4 py-12 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300 ${file
                            ? 'border-blue-500/50 bg-blue-500/5'
                            : 'border-current/10 glass hover:border-blue-500/30'
                            }`}
                    >
                        {file ? (
                            <div className="animate-in fade-in zoom-in duration-300">
                                <div className="text-5xl mb-4 drop-shadow-lg">📄</div>
                                <div className="font-bold text-lg mb-1">{file.name}</div>
                                <div className="text-xs text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full inline-block font-mono">
                                    {(file.size / 1024).toFixed(2)} KB
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="text-5xl mb-4 opacity-30">📁</div>
                                <div className="font-bold text-lg mb-1 opacity-60">点击选择代码文件</div>
                                <div className="text-xs opacity-40">支持 .js, .ts 格式</div>
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
