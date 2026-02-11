import React, { useState, forwardRef, useImperativeHandle } from 'react';
import Editor from '@monaco-editor/react';
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
    );
});

WorkerForm.displayName = 'WorkerForm';

export default WorkerForm;
