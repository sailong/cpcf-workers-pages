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
        try {
            if (isPages) {
                if (!selectedFile) return;
                await FileService.writeContent(project.id, selectedFile, code);
                // Toast?
            } else {
                await ProjectService.updateCode(project.id, code);
                onSaved(); // Notify parent
            }
        } catch (e) {
            console.error(e);
            alert('Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#1e1e1e] flex flex-col text-gray-300 font-sans">
            {/* Flat Header */}
            <div className="h-12 bg-[#252526] border-b border-[#3e3e42] flex justify-between items-center px-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium hover:bg-[#333] px-2 py-1 rounded">
                        <span>←</span> 返回
                    </button>
                    <div className="h-4 w-[1px] bg-[#444]"></div>
                    <span className="font-bold text-gray-100 tracking-wide">{project.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${project.type === 'worker' ? 'border-blue-900/50 bg-blue-900/20 text-blue-400' : 'border-purple-900/50 bg-purple-900/20 text-purple-400'
                        }`}>
                        {project.type}
                    </span>
                </div>
                <div className="flex bg-[#1e1e1e] rounded p-0.5 border border-[#333]">
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`px-4 py-1 rounded text-xs font-medium transition-all ${activeTab === 'code' ? 'bg-[#37373d] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        代码编辑器
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-1 rounded text-xs font-medium transition-all ${activeTab === 'config' ? 'bg-[#37373d] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        项目配置
                    </button>
                    {isPages && (
                        <button
                            onClick={() => setActiveTab('deploy')}
                            className={`px-4 py-1 rounded text-xs font-medium transition-all ${activeTab === 'deploy' ? 'bg-[#37373d] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
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
                            <div className="w-64 bg-[#252526] border-r border-[#3e3e42] flex flex-col">
                                <div className="h-9 flex items-center px-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-[#2d2d2d] bg-[#252526]">
                                    资源管理器
                                </div>
                                <FileTree projectId={project.id} onSelect={handleFileSelect} selectedPath={selectedFile} />
                            </div>
                        )}
                        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                            {/* Editor Toolbar */}
                            <div className="h-9 bg-[#1e1e1e] border-b border-[#3e3e42] flex items-center justify-between px-4">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-blue-400">📄</span>
                                    <span className="text-gray-400">{selectedFile || (isPages ? '请选择文件' : 'worker.js')}</span>
                                </div>
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
                    <div className="flex-1 bg-[#1e1e1e] overflow-y-auto p-8">
                        <div className="max-w-4xl mx-auto">
                            <ConfigPanel project={project} onSave={onSaved} />
                        </div>
                    </div>
                )}

                {activeTab === 'deploy' && (
                    <div className="flex-1 bg-[#1e1e1e] flex flex-col">
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
                        <div className="h-64 bg-[#0d0d0d] border-t border-[#3e3e42] font-mono text-xs flex flex-col">
                            <div className="px-4 py-1 bg-[#252526] border-b border-[#3e3e42] text-gray-500 font-bold uppercase tracking-wider text-[10px]">构建日志</div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                                {logs.map((log, i) => <div key={i} className="text-gray-400 border-b border-gray-900/50 pb-0.5">{log}</div>)}
                                {logs.length === 0 && <div className="text-gray-700 italic">暂无日志...</div>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IDE;
