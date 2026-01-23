import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import JSZip from 'jszip';
import { authenticatedFetch } from './api';

interface Binding {
    varName: string;
    resourceId: string;
}

interface EnvVar {
    type: 'plain' | 'json' | 'secret';
    value: string | object;
}

interface CodeEditorModalProps {
    project: {
        id: string;
        name: string;
        mainFile: string;
        type?: 'worker' | 'pages';
    };
    onClose: () => void;
    onSaved: () => void;
}

type TabType = 'code' | 'bindings' | 'envvars' | 'settings';

const CodeEditorModal: React.FC<CodeEditorModalProps> = ({ project, onClose, onSaved }) => {
    // Project Type Checking
    const isPages = project.type === 'pages';

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('code');

    // Code/Editor state
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');

    // Pages File Manager State
    const [fileList, setFileList] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Config state
    const [bindings, setBindings] = useState<{ kv: Binding[]; d1: Binding[]; r2: Binding[] }>({ kv: [], d1: [], r2: [] });
    const [envVars, setEnvVars] = useState<Record<string, EnvVar>>({});
    const [port, setPort] = useState<number>(0);

    // UI state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [processing, setProcessing] = useState(false); // For Pages Zip
    const [error, setError] = useState('');

    // Toast State
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Available resources (for bindings)
    const [kvResources, setKvResources] = useState<any[]>([]);
    const [d1Resources, setD1Resources] = useState<any[]>([]);
    const [r2Resources, setR2Resources] = useState<any[]>([]);

    // Pages Update State (Bulk Upload)
    const [pagesFile, setPagesFile] = useState<File | null>(null);
    const [uploadType, setUploadType] = useState<'zip' | 'folder'>('folder');
    const [showUploadModal, setShowUploadModal] = useState(false); // To toggle upload UI inside Pages view

    // Load full config
    useEffect(() => {
        loadProjectData();
    }, [project.id]);

    const loadProjectData = async () => {
        setLoading(true);
        setError('');
        try {
            // Load Config
            const res = await authenticatedFetch(`/api/projects/${project.id}/full-config`);
            if (!res.ok) throw new Error('加载配置失败');
            const data = await res.json();

            // Set Common Data
            setPort(data.port);

            if (isPages) {
                // For Pages: List files
                await loadFileList();
            } else {
                // For Workers: Set Code & Bindings
                setCode(data.code);
                setLanguage(data.language);
                setBindings({
                    kv: data.bindings?.kv || [],
                    d1: data.bindings?.d1 || [],
                    r2: data.bindings?.r2 || []
                });
                setEnvVars(data.envVarsRaw || {});
                loadResources();
            }
        } catch (err) {
            setError('加载失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadResources = async () => {
        try {
            const [kvRes, d1Res, r2Res] = await Promise.all([
                authenticatedFetch('/api/resources/kv'),
                authenticatedFetch('/api/resources/d1'),
                authenticatedFetch('/api/resources/r2')
            ]);
            setKvResources(await kvRes.json());
            setD1Resources(await d1Res.json());
            setR2Resources(await r2Res.json());
        } catch (err) {
            console.error('Failed to load resources:', err);
        }
    };

    // --- Pages File Manager Logic ---

    const loadFileList = async () => {
        try {
            const res = await authenticatedFetch(`/api/projects/${project.id}/files/list`);
            if (res.ok) {
                const files = await res.json(); // Array of strings or error
                if (Array.isArray(files)) {
                    setFileList(files);
                    if (files.length > 0 && !selectedFile) {
                        const indexFile = files.find((f: string) => f.endsWith('index.html')) || files[0];
                        loadFileContent(indexFile);
                    }
                } else {
                    console.error("File list error:", files);
                    setFileList([]);
                }
            } else {
                console.error("Failed to list files, status:", res.status);
            }
        } catch (e) {
            console.error("Failed to list files exception:", e);
        }
    };

    const loadFileContent = async (path: string) => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`/api/projects/${project.id}/files/content?path=${encodeURIComponent(path)}`);
            if (res.ok) {
                const data = await res.json();
                setCode(data.content);
                setSelectedFile(path);

                // Determine language
                if (path.endsWith('.html')) setLanguage('html');
                else if (path.endsWith('.css')) setLanguage('css');
                else if (path.endsWith('.js')) setLanguage('javascript');
                else if (path.endsWith('.ts')) setLanguage('typescript');
                else if (path.endsWith('.json')) setLanguage('json');
                else setLanguage('plaintext');
            }
        } catch (e) {
            setError("无法读取文件内容");
        } finally {
            setLoading(false);
        }
    };

    const handleSavePagesFile = async () => {
        if (!selectedFile) return;
        setSaving(true);
        try {
            const res = await authenticatedFetch(`/api/projects/${project.id}/files/content`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: selectedFile, content: code })
            });

            if (res.ok) {
                showToast('文件已保存');
            } else {
                throw new Error('保存失败');
            }
        } catch (e) {
            showToast('保存失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Pages Bulk Upload Logic ---

    const handlePagesFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setProcessing(true);
        setError('');

        try {
            const zip = new JSZip();
            const fileArray = Array.from(files);

            if (fileArray.length > 0) {
                // Strip root logic
                const firstPathParts = fileArray[0].webkitRelativePath.split('/');
                if (firstPathParts.length > 1) {
                    const candidateRoot = firstPathParts[0] + '/';
                    const hasCommonRoot = fileArray.every(f => f.webkitRelativePath.startsWith(candidateRoot));

                    if (hasCommonRoot) {
                        fileArray.forEach(file => {
                            const cleanPath = file.webkitRelativePath.substring(candidateRoot.length);
                            if (cleanPath) zip.file(cleanPath, file);
                        });
                    } else {
                        fileArray.forEach(file => zip.file(file.webkitRelativePath, file));
                    }
                } else {
                    fileArray.forEach(file => zip.file(file.webkitRelativePath, file));
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            const zipFile = new File([content], "update.zip", { type: "application/zip" });
            setPagesFile(zipFile);
        } catch (err) {
            console.error(err);
            setError("文件夹打包失败");
        } finally {
            setProcessing(false);
        }
    };

    const handlePagesUpdate = async () => {
        if (!pagesFile) return;
        setSaving(true);
        setError('');

        const formData = new FormData();
        formData.append('file', pagesFile);

        try {
            const res = await authenticatedFetch(`/api/projects/${project.id}/upload-replace`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '更新失败');
            }

            const data = await res.json();
            showToast(data.restarted ? '站点已更新' : '站点已更新');
            setPagesFile(null);
            setShowUploadModal(false);
            loadFileList(); // Refresh list
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : '更新失败');
        } finally {
            setSaving(false);
        }
    };


    // --- Workers Logic ---

    const handleSaveWorkerCode = async () => {
        setSaving(true);
        setError('');
        try {
            const res = await authenticatedFetch(`/api/projects/${project.id}/code`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '保存失败');
            }

            const data = await res.json();
            showToast(data.restarted ? '代码已保存，Worker 已重启' : '代码已保存');
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
            showToast('保存失败: ' + (err instanceof Error ? err.message : '未知错误'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveConfig = async () => {
        setSaving(true);
        setError('');
        try {
            const res = await authenticatedFetch(`/api/projects/${project.id}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bindings, envVars, port })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '保存失败');
            }

            const data = await res.json();
            const message = data.restarted ? '配置已更新，Worker 已重启' : '配置已保存';
            showToast(message);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
            showToast('保存失败: ' + (err instanceof Error ? err.message : '未知错误'), 'error');
        } finally {
            setSaving(false);
        }
    };

    // File upload (Worker JS)
    const handleWorkerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.js') && !file.name.endsWith('.ts')) {
            showToast('只支持 .js 和 .ts 文件', 'error'); return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await authenticatedFetch(`/api/projects/${project.id}/upload-replace`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error('上传失败');
            const data = await res.json();
            showToast(data.restarted ? '文件已替换，Worker 已重启' : '文件已替换');
            loadProjectData(); onSaved();
        } catch (err) { showToast('上传失败: ' + (err instanceof Error ? err.message : '未知错误'), 'error'); }
        e.target.value = '';
    };

    // --- Helper Components & Render ---

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl overflow-hidden relative">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            {isPages ? '站点文件管理' : '编辑 Worker'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${isPages ? 'bg-purple-500' : 'bg-orange-500'}`} />
                            <p className="text-gray-400 text-sm font-mono">{project.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-700 bg-gray-900">
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'code' ? 'text-orange-400 border-orange-400 bg-gray-800' : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'}`}
                    >
                        {isPages ? '📄 站点内容' : '📝 代码'}
                    </button>
                    {!isPages && (
                        <>
                            <button
                                onClick={() => setActiveTab('bindings')}
                                className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'bindings' ? 'text-orange-400 border-orange-400 bg-gray-800' : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'}`}
                            >
                                🔗 绑定
                            </button>
                            <button
                                onClick={() => setActiveTab('envvars')}
                                className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'envvars' ? 'text-orange-400 border-orange-400 bg-gray-800' : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'}`}
                            >
                                🔒 变量
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'settings' ? 'text-orange-400 border-orange-400 bg-gray-800' : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'}`}
                    >
                        ⚙️ 设置
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>
                    ) : (
                        <>
                            {activeTab === 'code' && (
                                isPages ? (
                                    // --- PAGES LAYOUT (Split View) ---
                                    <div className="flex h-full">
                                        {/* Sidebar (File Tree) */}
                                        <div className={`w-64 bg-gray-900 border-r border-gray-700 flex flex-col ${isSidebarOpen ? '' : 'hidden'}`}>
                                            <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
                                                <span className="text-gray-400 text-sm font-bold">文件列表</span>
                                                <button onClick={loadFileList} className="text-gray-500 hover:text-white" title="Refresh">↻</button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                                                {fileList.length === 0 && <div className="p-4 text-gray-500 text-xs text-center">暂无文件</div>}
                                                {fileList.map((file, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => loadFileContent(file)}
                                                        className={`w-full text-left px-3 py-1.5 rounded text-sm truncate font-mono transition-colors ${selectedFile === file
                                                            ? 'bg-purple-900/50 text-purple-200 border-l-2 border-purple-500'
                                                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                                                        title={file}
                                                    >
                                                        {file}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Folder/Zip Sync Button */}
                                            <div className="p-3 border-t border-gray-700 bg-gray-850">
                                                <button
                                                    onClick={() => setShowUploadModal(true)}
                                                    className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-sm text-gray-300 flex items-center justify-center gap-2"
                                                >
                                                    <span>📤</span> 更新站点
                                                </button>
                                            </div>
                                        </div>

                                        {/* Editor Area */}
                                        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                                            {/* Toolbar */}
                                            <div className="h-10 border-b border-gray-700 flex items-center px-4 bg-gray-900 justify-between">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-white px-2">
                                                        {isSidebarOpen ? '◀' : '▶'}
                                                    </button>
                                                    <span className="text-gray-300 text-sm font-mono">{selectedFile || '未选择文件'}</span>
                                                </div>
                                                {selectedFile && (
                                                    <button
                                                        onClick={handleSavePagesFile}
                                                        disabled={saving}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs flex items-center gap-1 disabled:bg-gray-700"
                                                    >
                                                        {saving ? '保存中...' : '💾 保存更改'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Editor */}
                                            <div className="flex-1 overflow-hidden">
                                                {selectedFile ? (
                                                    <Editor
                                                        height="100%"
                                                        language={language}
                                                        value={code}
                                                        onChange={(val) => setCode(val || '')}
                                                        theme="vs-dark"
                                                        options={{ minimap: { enabled: true }, fontSize: 13, automaticLayout: true }}
                                                    />
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                                        <div className="text-4xl mb-4">📄</div>
                                                        <p>请从左侧选择文件进行编辑</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // --- WORKER LAYOUT (Editor) ---
                                    <div className="h-full flex flex-col">
                                        <div className="flex gap-2 p-4 border-b border-gray-700 bg-gray-900">
                                            <button onClick={handleSaveWorkerCode} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded font-medium disabled:bg-gray-600">💾 保存代码</button>
                                            <label className="px-4 py-2 bg-blue-600 text-white rounded font-medium cursor-pointer">📁 上传替换 <input type="file" accept=".js,.ts" onChange={handleWorkerFileUpload} className="hidden" /></label>
                                        </div>
                                        <div className="flex-1"><Editor height="100%" language={language} value={code} onChange={v => setCode(v || '')} theme="vs-dark" options={{ minimap: { enabled: true }, fontSize: 14, automaticLayout: true }} /></div>
                                    </div>
                                )
                            )}

                            {activeTab === 'bindings' && !isPages && <BindingsTab bindings={bindings} kvResources={kvResources} d1Resources={d1Resources} r2Resources={r2Resources} onAddKv={() => { setBindings({ ...bindings, kv: [...bindings.kv, { varName: '', resourceId: '' }] }) }} onRemoveKv={(i: number) => setBindings({ ...bindings, kv: bindings.kv.filter((_, idx) => idx !== i) })} onUpdateKv={(i: number, f: 'varName' | 'resourceId', v: string) => { const k = [...bindings.kv]; k[i][f] = v; setBindings({ ...bindings, kv: k }) }} onAddD1={() => { setBindings({ ...bindings, d1: [...bindings.d1, { varName: '', resourceId: '' }] }) }} onRemoveD1={(i: number) => setBindings({ ...bindings, d1: bindings.d1.filter((_, idx) => idx !== i) })} onUpdateD1={(i: number, f: 'varName' | 'resourceId', v: string) => { const k = [...bindings.d1]; k[i][f] = v; setBindings({ ...bindings, d1: k }) }} onAddR2={() => { setBindings({ ...bindings, r2: [...bindings.r2, { varName: '', resourceId: '' }] }) }} onRemoveR2={(i: number) => setBindings({ ...bindings, r2: bindings.r2.filter((_, idx) => idx !== i) })} onUpdateR2={(i: number, f: 'varName' | 'resourceId', v: string) => { const k = [...bindings.r2]; k[i][f] = v; setBindings({ ...bindings, r2: k }) }} onSave={handleSaveConfig} saving={saving} />}

                            {activeTab === 'envvars' && !isPages && <EnvVarsTab envVars={envVars} onAdd={(k: string, t: any, v: string) => setEnvVars({ ...envVars, [k]: { type: t, value: t === 'json' ? JSON.parse(v) : v } })} onRemove={(k: string) => { const e = { ...envVars }; delete e[k]; setEnvVars(e) }} onSave={handleSaveConfig} saving={saving} />}

                            {activeTab === 'settings' && <SettingsTab port={port} onChangePort={setPort} onSave={handleSaveConfig} saving={saving} />}
                        </>
                    )}
                </div>

                {/* Upload Modal Overlay for Pages */}
                {showUploadModal && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60]">
                        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-lg w-full relative shadow-2xl">
                            <button onClick={() => setShowUploadModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
                            <h3 className="text-xl font-bold text-white mb-6">更新站点内容</h3>
                            <div className="flex gap-4 mb-6">
                                <button onClick={() => setUploadType('folder')} className={`flex-1 px-4 py-2 rounded border ${uploadType === 'folder' ? 'bg-gray-800 border-orange-500 text-white' : 'border-gray-700 text-gray-500'}`}>📁 文件夹</button>
                                <button onClick={() => setUploadType('zip')} className={`flex-1 px-4 py-2 rounded border ${uploadType === 'zip' ? 'bg-gray-800 border-orange-500 text-white' : 'border-gray-700 text-gray-500'}`}>📦 ZIP</button>
                            </div>
                            {uploadType === 'folder' ? (
                                <div className="relative mb-6">
                                    <input type="file"
                                        // @ts-ignore
                                        webkitdirectory="" directory="" multiple
                                        onChange={handlePagesFolderSelect} className="hidden" id="modal-folder" />
                                    <label htmlFor="modal-folder" className="block w-full px-4 py-12 bg-gray-950 border-2 border-dashed border-gray-800 rounded-lg text-center cursor-pointer hover:border-orange-500 transition-colors">
                                        {processing ? <div className="text-orange-400">打包中...</div> : pagesFile ? <div><div className="text-2xl mb-2">📦</div>{pagesFile.name}</div> : <div><div className="text-4xl mb-2">📂</div><div className="text-gray-500">点击选择文件夹</div></div>}
                                    </label>
                                </div>
                            ) : (
                                <div className="relative mb-6">
                                    <input type="file" accept=".zip" onChange={e => setPagesFile(e.target.files?.[0] || null)} className="hidden" id="modal-zip" />
                                    <label htmlFor="modal-zip" className="block w-full px-4 py-12 bg-gray-950 border-2 border-dashed border-gray-800 rounded-lg text-center cursor-pointer hover:border-orange-500 transition-colors">
                                        {pagesFile ? <div><div className="text-2xl mb-2">📦</div>{pagesFile.name}</div> : <div><div className="text-4xl mb-2">🤐</div><div className="text-gray-500">点击选择 ZIP</div></div>}
                                    </label>
                                </div>
                            )}
                            <button onClick={handlePagesUpdate} disabled={!pagesFile || saving} className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold disabled:bg-gray-700">
                                {saving ? '部署中...' : '确认更新'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Toast Notification */}
                {toast && (
                    <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg text-white font-medium animate-fade-in-down z-[70] ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                        {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-components (Kept compact but typed)
const BindingsTab: React.FC<any> = ({ bindings, kvResources, d1Resources, r2Resources, onAddKv, onRemoveKv, onUpdateKv, onAddD1, onRemoveD1, onUpdateD1, onAddR2, onRemoveR2, onUpdateR2, onSave, saving }) => (
    <div className="h-full overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-8">
            {/* KV Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📦</span>
                        <h3 className="text-lg font-bold text-gray-200">KV 键值存储绑定</h3>
                    </div>
                    <button
                        onClick={onAddKv}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                    >
                        <span>+</span> 添加绑定
                    </button>
                </div>

                <div className="p-4">
                    {bindings.kv.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm bg-gray-950/30 rounded-lg border border-dashed border-gray-800">
                            暂无 KV 绑定，请点击右上角添加
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <div className="grid grid-cols-12 gap-4 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <div className="col-span-1"></div>
                                <div className="col-span-5">变量名 (Variable)</div>
                                <div className="col-span-5">绑定资源 (Namespace)</div>
                                <div className="col-span-1 text-center">操作</div>
                            </div>
                            {bindings.kv.map((b: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 gap-4 items-center bg-gray-950/50 p-2 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                                    <div className="col-span-1 text-center text-gray-600 font-mono text-sm">{i + 1}</div>
                                    <div className="col-span-5">
                                        <input
                                            value={b.varName}
                                            onChange={e => onUpdateKv(i, 'varName', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-600 font-mono"
                                            placeholder="MY_KV"
                                        />
                                    </div>
                                    <div className="col-span-5">
                                        <select
                                            value={b.resourceId}
                                            onChange={e => onUpdateKv(i, 'resourceId', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="">-- 选择 KV 资源 --</option>
                                            {kvResources.map((k: any) => (
                                                <option key={k.id} value={k.id}>{k.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            onClick={() => onRemoveKv(i)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            title="删除绑定"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* D1 Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🗄️</span>
                        <h3 className="text-lg font-bold text-gray-200">D1 数据库绑定</h3>
                    </div>
                    <button
                        onClick={onAddD1}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                    >
                        <span>+</span> 添加绑定
                    </button>
                </div>

                <div className="p-4">
                    {bindings.d1.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm bg-gray-950/30 rounded-lg border border-dashed border-gray-800">
                            暂无 D1 绑定，请点击右上角添加
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <div className="grid grid-cols-12 gap-4 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <div className="col-span-1"></div>
                                <div className="col-span-5">变量名 (Variable)</div>
                                <div className="col-span-5">绑定数据库 (Database)</div>
                                <div className="col-span-1 text-center">操作</div>
                            </div>
                            {bindings.d1.map((b: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 gap-4 items-center bg-gray-950/50 p-2 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                                    <div className="col-span-1 text-center text-gray-600 font-mono text-sm">{i + 1}</div>
                                    <div className="col-span-5">
                                        <input
                                            value={b.varName}
                                            onChange={e => onUpdateD1(i, 'varName', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder-gray-600 font-mono"
                                            placeholder="DB"
                                        />
                                    </div>
                                    <div className="col-span-5">
                                        <select
                                            value={b.resourceId}
                                            onChange={e => onUpdateD1(i, 'resourceId', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded px-3 py-2 text-sm focus:border-purple-500 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="">-- 选择 D1 数据库 --</option>
                                            {d1Resources.map((k: any) => (
                                                <option key={k.id} value={k.id}>{k.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            onClick={() => onRemoveD1(i)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            title="删除绑定"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>



            {/* R2 Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🪣</span>
                        <h3 className="text-lg font-bold text-gray-200">R2 对象存储绑定</h3>
                    </div>
                    <button
                        onClick={onAddR2}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                    >
                        <span>+</span> 添加绑定
                    </button>
                </div>

                <div className="p-4">
                    {bindings.r2 && bindings.r2.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm bg-gray-950/30 rounded-lg border border-dashed border-gray-800">
                            暂无 R2 绑定，请点击右上角添加
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <div className="grid grid-cols-12 gap-4 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <div className="col-span-1"></div>
                                <div className="col-span-5">变量名 (Variable)</div>
                                <div className="col-span-5">绑定存储桶 (Bucket)</div>
                                <div className="col-span-1 text-center">操作</div>
                            </div>
                            {bindings.r2 && bindings.r2.map((b: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 gap-4 items-center bg-gray-950/50 p-2 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                                    <div className="col-span-1 text-center text-gray-600 font-mono text-sm">{i + 1}</div>
                                    <div className="col-span-5">
                                        <input
                                            value={b.varName}
                                            onChange={e => onUpdateR2(i, 'varName', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all placeholder-gray-600 font-mono"
                                            placeholder="MY_BUCKET"
                                        />
                                    </div>
                                    <div className="col-span-5">
                                        <select
                                            value={b.resourceId}
                                            onChange={e => onUpdateR2(i, 'resourceId', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded px-3 py-2 text-sm focus:border-yellow-500 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="">-- 选择 R2 存储桶 --</option>
                                            {r2Resources.map((k: any) => (
                                                <option key={k.id} value={k.id}>{k.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            onClick={() => onRemoveR2(i)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            title="删除绑定"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Save Action */}
            <div className="pt-6 border-t border-gray-800 sticky bottom-0 bg-[#1e1e1e] pb-2">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="w-full px-4 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                >
                    {saving ? '正在保存配置并重启 Worker...' : '💾 保存配置并重启生效'}
                </button>
                <p className="text-center text-gray-600 text-xs mt-3">
                    修改绑定配置需要重启 Worker 进程才能生效
                </p>
            </div>
        </div >
    </div >
);
const EnvVarsTab: React.FC<any> = ({ envVars, onAdd, onRemove, onSave, saving }) => {
    const [k, setK] = useState('');
    const [t, setT] = useState('plain');
    const [v, setV] = useState('');
    const [showValues, setShowValues] = useState(true);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Add New Var */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <span>➕</span> 添加环境变量
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-3">
                            <label className="block text-xs text-gray-500 mb-1 font-mono uppercase">变量名 (Key)</label>
                            <input
                                value={k}
                                onChange={e => setK(e.target.value)}
                                placeholder="API_KEY"
                                className="w-full bg-gray-950 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-blue-500 outline-none font-mono text-sm"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1 font-mono uppercase">类型 (Type)</label>
                            <select
                                value={t}
                                onChange={e => setT(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-blue-500 outline-none text-sm"
                            >
                                <option value="plain">普通文本</option>
                                <option value="json">JSON 对象</option>
                                <option value="secret">加密密钥</option>
                            </select>
                        </div>
                        <div className="md:col-span-6">
                            <label className="block text-xs text-gray-500 mb-1 font-mono uppercase">值 (Value)</label>
                            <input
                                value={v}
                                onChange={e => setV(e.target.value)}
                                placeholder="Value..."
                                className="w-full bg-gray-950 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-blue-500 outline-none font-mono text-sm"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <button
                                onClick={() => { onAdd(k, t, v); setK(''); setV('') }}
                                disabled={!k}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2.5 font-medium transition-colors"
                            >
                                添加
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Vars */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden min-h-[300px] flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                        <h3 className="text-lg font-bold text-gray-200">当前变量列表</h3>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none hover:text-white transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showValues}
                                    onChange={e => setShowValues(e.target.checked)}
                                    className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-offset-gray-900"
                                />
                                显示值
                            </label>
                            <span className="bg-gray-700 text-xs px-2 py-1 rounded-full text-gray-300">
                                共 {Object.keys(envVars).length} 个
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 p-0">
                        {Object.keys(envVars).length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                <span className="text-2xl mb-2">∅</span>
                                <p>暂无环境变量</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-800">
                                {Object.entries(envVars).map(([ky, vl]: any) => (
                                    <div key={ky} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors group items-center">
                                        <div className="col-span-3 font-mono text-blue-300 font-medium truncate" title={ky}>
                                            {ky}
                                        </div>
                                        <div className="col-span-2">
                                            <span className={`text-xs px-2 py-1 rounded border ${vl.type === 'secret' ? 'bg-red-900/20 text-red-400 border-red-900/50' :
                                                vl.type === 'json' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50' :
                                                    'bg-gray-700 text-gray-300 border-gray-600'
                                                }`}>
                                                {vl.type.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="col-span-6 font-mono text-sm text-gray-300 break-all">
                                            {showValues ? (
                                                vl.type === 'json' ? JSON.stringify(vl.value) : vl.value
                                            ) : (
                                                <span className="text-gray-600 italic">••••••</span>
                                            )}
                                        </div>
                                        <div className="col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onRemove(ky)}
                                                className="text-red-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded"
                                                title="删除"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Action */}
                <div className="pt-6 border-t border-gray-800 sticky bottom-0 bg-[#1e1e1e] pb-2">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="w-full px-4 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                        {saving ? '正在保存...' : '💾 保存环境变量'}
                    </button>
                </div>
            </div>
        </div>
    );
};
const SettingsTab: React.FC<any> = ({ port, onChangePort, onSave, saving }) => (<div className="h-full overflow-y-auto p-6"><div className="max-w-4xl mx-auto space-y-6"><div className="bg-gray-900 p-6 rounded border border-gray-700"><label className="block text-gray-400 mb-2">运行端口 (Port)</label><input type="number" value={port} onChange={e => onChangePort(parseInt(e.target.value))} className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none" /></div><div className="pt-4 border-t border-gray-700"><button onClick={onSave} disabled={saving} className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors">{saving ? '保存中...' : '保存设置'}</button></div></div></div>);

export default CodeEditorModal;
