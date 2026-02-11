import React, { useState, useEffect } from 'react';
import type { Project } from '../../types';
import { ProjectService, FileService } from '../../services';
import ConfigPanel from './ConfigPanel';
import DeployPanel from './DeployPanel';
import FileTree from './FileTree';
import Editor from './Editor';

interface IDEProps {
    project: Project;
    onClose: () => void;
    onSaved: () => void;
}

type TabType = 'code' | 'config' | 'deploy';

const IDE: React.FC<IDEProps> = ({ project, onClose, onSaved }) => {
    const [activeTab, setActiveTab] = useState<TabType>('code');
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const isPages = project.type === 'pages';

    // Initial Load
    useEffect(() => {
        if (!isPages) {
            loadWorkerCode();
        }
    }, [project.id]);

    const loadWorkerCode = async () => {
        setLoading(true);
        try {
            const data = await ProjectService.getCode(project.id);
            setCode(data.code);
            // Detect language from mainFile extension or content
            setLanguage(data.language || 'javascript');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (path: string) => {
        setSelectedFile(path);
        setLoading(true);
        try {
            const content = await FileService.readContent(project.id, path);
            setCode(content);

            if (path.endsWith('.html')) setLanguage('html');
            else if (path.endsWith('.css')) setLanguage('css');
            else if (path.endsWith('.js')) setLanguage('javascript');
            else if (path.endsWith('.ts')) setLanguage('typescript');
            else if (path.endsWith('.json')) setLanguage('json');
            else setLanguage('plaintext');

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCode = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            if (isPages) {
                if (!selectedFile) return;
                await FileService.writeContent(project.id, selectedFile, code);
            } else {
                await ProjectService.updateCode(project.id, code);
            }
            onSaved(); // Notify parent for data refresh
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            console.error(e);
            alert('Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col font-sans transition-colors duration-300">
            {/* Flat Header */}
            <div className="h-12 glass border-b flex justify-between items-center px-4 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 text-sm font-bold hover:bg-current/5 px-2 py-1 rounded">
                        <span>←</span> 返回
                    </button>
                    <div className="h-4 w-px bg-current opacity-10"></div>
                    <span className="font-bold tracking-wide">{project.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${project.type === 'worker' ? 'border-blue-500/30 bg-blue-500/10 text-blue-500' : 'border-purple-500/30 bg-purple-500/10 text-purple-500'
                        }`}>
                        {project.type}
                    </span>
                </div>
                <div className="flex glass rounded-lg p-0.5 border-transparent">
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'code' ? 'bg-blue-500/10 text-blue-500 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                    >
                        代码编辑器
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'config' ? 'bg-blue-500/10 text-blue-500 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                    >
                        项目配置
                    </button>
                    {isPages && (
                        <button
                            onClick={() => setActiveTab('deploy')}
                            className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'deploy' ? 'bg-blue-500/10 text-blue-500 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                        >
                            部署管理
                        </button>
                    )}
                </div>
                <div className="w-20 flex justify-end">
                    {/* Placeholder for right side actions or just empty to balance */}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'code' && (
                    <>
                        {isPages && (
                            <div className="w-64 glass border-r flex flex-col">
                                <div className="h-9 flex items-center px-4 text-[10px] font-bold opacity-40 uppercase tracking-widest border-b">
                                    资源管理器
                                </div>
                                <FileTree projectId={project.id} onSelect={handleFileSelect} selectedPath={selectedFile} />
                            </div>
                        )}
                        <div className="flex-1 flex flex-col glass rounded-none border-0 border-l">
                            {/* Editor Toolbar */}
                            <div className="h-9 glass border-b rounded-none border-0 border-b flex items-center justify-between px-4">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-blue-400">📄</span>
                                    <span className="text-gray-400">{selectedFile || (isPages ? '请选择文件' : 'worker.js')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {saveSuccess && (
                                        <span className="text-xs text-green-400 animate-fade-in flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                            已保存
                                        </span>
                                    )}
                                    <button
                                        onClick={handleSaveCode}
                                        disabled={saving || (isPages && !selectedFile)}
                                        className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${saving || (isPages && !selectedFile)
                                            ? 'bg-[#2d2d2d] text-gray-600 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                                            }`}
                                    >
                                        {saving ? '保存中...' : '💾 保存更改'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                {loading ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">正在加载文件内容...</div>
                                ) : (
                                    <Editor
                                        code={code}
                                        language={language}
                                        onChange={(v) => setCode(v || '')}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'config' && (
                    <div className="flex-1 overflow-y-auto p-8 glass border-0">
                        <div className="max-w-4xl mx-auto">
                            <ConfigPanel project={project} onSave={onSaved} />
                        </div>
                    </div>
                )}

                {activeTab === 'deploy' && (
                    <div className="flex-1 flex flex-col glass border-0 overflow-hidden">
                        <div className="flex-1 p-8 overflow-y-auto">
                            <div className="max-w-4xl mx-auto">
                                <DeployPanel
                                    project={project}
                                    onLog={(msg) => setLogs(prev => [...prev, msg])}
                                    onSuccess={() => {
                                        onSaved();
                                    }}
                                />
                            </div>
                        </div>
                        {/* Logs Panel */}
                        <div className="h-64 glass border-t-2 rounded-none font-mono text-xs flex flex-col shadow-2xl">
                            <div className="px-4 py-2 glass border-0 border-b text-[10px] font-bold opacity-40 uppercase tracking-widest">构建日志</div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-black/5">
                                {logs.map((log, i) => <div key={i} className="opacity-70 border-b border-current/5 pb-0.5">{log}</div>)}
                                {logs.length === 0 && <div className="opacity-30 italic">暂无日志...</div>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IDE;
