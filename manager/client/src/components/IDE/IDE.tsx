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
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="bg-[#1e1e1e] w-full h-full flex flex-col text-gray-300">
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-black">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-white">{project.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700">{project.type}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('code')}
                            className={`px-3 py-1 rounded text-sm ${activeTab === 'code' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
                        >
                            代码 (Code)
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-3 py-1 rounded text-sm ${activeTab === 'config' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
                        >
                            配置 (Config)
                        </button>
                        {isPages && (
                            <button
                                onClick={() => setActiveTab('deploy')}
                                className={`px-3 py-1 rounded text-sm ${activeTab === 'deploy' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
                            >
                                部署 (Deploy)
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white px-2">✕</button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {activeTab === 'code' && (
                        <>
                            {isPages && (
                                <div className="w-64 bg-[#252526] border-r border-black flex flex-col">
                                    <div className="p-2 text-xs font-bold text-gray-400 uppercase tracking-wider">文件列表 (Files)</div>
                                    <FileTree projectId={project.id} onSelect={handleFileSelect} selectedPath={selectedFile} />
                                </div>
                            )}
                            <div className="flex-1 flex flex-col">
                                {/* Editor Toolbar */}
                                <div className="h-8 bg-[#2d2d2d] flex items-center justify-between px-4">
                                    <span className="text-xs text-gray-500">{selectedFile || (isPages ? '未选择文件' : 'Worker 主文件')}</span>
                                    <button
                                        onClick={handleSaveCode}
                                        disabled={saving || (isPages && !selectedFile)}
                                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-0.5 rounded disabled:opacity-50"
                                    >
                                        {saving ? '保存中...' : '保存代码'}
                                    </button>
                                </div>
                                <div className="flex-1 relative">
                                    {loading ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">加载中...</div>
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
                        <div className="flex-1 bg-[#1e1e1e]">
                            <ConfigPanel project={project} onSave={onSaved} />
                        </div>
                    )}

                    {activeTab === 'deploy' && (
                        <div className="flex-1 bg-[#1e1e1e] flex flex-col">
                            <DeployPanel
                                project={project}
                                onLog={(msg) => setLogs(prev => [...prev, msg])}
                                onSuccess={() => {
                                    alert('部署成功');
                                    onSaved();
                                }}
                            />
                            {/* Logs Panel */}
                            <div className="h-48 bg-black border-t border-gray-700 p-2 font-mono text-xs overflow-y-auto">
                                {logs.map((log, i) => <div key={i}>{log}</div>)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IDE;
