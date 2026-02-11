import React, { useState, useEffect } from 'react';
import type { Project } from '../types';
import { ProjectService } from '../services';
import IDE from '../components/IDE/IDE';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { useNavigate } from 'react-router-dom';
import { removeToken } from '../api';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showChangePassword, setShowChangePassword] = useState(false);

    useEffect(() => {
        loadProjects();
        const interval = setInterval(loadProjects, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadProjects = async () => {
        try {
            const data = await ProjectService.getAll();
            setProjects(data);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleProject = async (p: Project) => {
        try {
            if (p.status === 'running') {
                await ProjectService.stop(p.id);
            } else {
                try {
                    await ProjectService.start(p.id);
                } catch (e: any) {
                    // Handle Port In Use (409)
                    if (e.response && e.response.status === 409) {
                        const confirmForce = window.confirm(
                            `⚠️ 端口 ${p.port} 正被系统或其他程序占用。\n\n是否强制释放端口并启动？\n(这将强制终止占用该端口的进程)`
                        );
                        if (confirmForce) {
                            await ProjectService.start(p.id, true);
                        } else {
                            return;
                        }
                    } else {
                        throw e;
                    }
                }
            }
            loadProjects();
        } catch (e: any) {
            console.error(e);
            alert('操作失败: ' + (e.response?.data?.error || e.message));
        }
    };

    const deleteProject = async (id: string) => {
        if (!confirm('确定要删除该项目吗？\n\n如果项目正在运行，将强制停止并释放端口。\n此操作不可恢复。')) return;
        try {
            await ProjectService.delete(id);
            loadProjects();
        } catch (e: any) {
            alert('删除失败: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleLogout = () => {
        removeToken();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-black text-gray-200 p-6 md:p-10 font-sans">
            <header className="max-w-7xl mx-auto flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">控制台</h1>
                    <p className="text-gray-500 text-sm mt-1">Cloudflare Workers & Pages Manager</p>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/resources')} className="glass-button px-5 py-2.5 rounded-xl font-medium flex items-center gap-2">
                        <span className="text-lg">📦</span>
                        <span>资源管理</span>
                    </button>

                    <a href="/create" className="btn-primary px-5 py-2.5 flex items-center gap-2">
                        <span className="text-lg">+</span>
                        <span>新建项目</span>
                    </a>

                    <div className="h-6 w-px bg-white/10 mx-2"></div>

                    <button onClick={() => setShowChangePassword(true)} className="text-gray-400 hover:text-white transition-colors p-2" title="修改密码">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </button>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors p-2" title="退出登录">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(p => (
                    <div key={p.id} className="glass-card p-6 flex flex-col justify-between group h-48 relative overflow-hidden">
                        {/* Status Dot */}
                        <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full shadow-lg ${p.status === 'running' ? 'bg-green-500 shadow-green-500/50 animate-pulse' : 'bg-gray-600'}`} />

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${p.type === 'worker'
                                    ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                                    : 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                                    }`}>
                                    {p.type}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1 truncate pr-8">{p.name}</h3>
                            <div className="text-xs text-gray-500 font-mono flex items-center gap-3">
                                <span>:{p.port}</span>
                                <span className="opacity-50">|</span>
                                <span>{p.id.substring(0, 8)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                            <div className="flex gap-2">
                                <button onClick={() => toggleProject(p)} className={`p-2 rounded-lg transition-colors ${p.status === 'running'
                                    ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                                    : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                    }`} title={p.status === 'running' ? '停止' : '启动'}>
                                    {p.status === 'running'
                                        ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    }
                                </button>
                                <button onClick={() => setEditingProject(p)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors" title="编辑">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                {p.status === 'running' && (
                                    <a href={`http://localhost:${p.port}`} target="_blank" className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors" title="打开应用">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </a>
                                )}
                            </div>

                            <button onClick={() => deleteProject(p.id)} className="text-gray-600 hover:text-red-500 transition-colors" title="删除">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {projects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-gray-600">
                    <div className="w-20 h-20 bg-[#1c1c1e] rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <span className="text-4xl opacity-50">🚀</span>
                    </div>
                    <h3 className="text-xl font-medium text-gray-400">暂无项目</h3>
                    <p className="text-sm mt-2 opacity-50">点击右上方新建项目开始</p>
                </div>
            )}

            {editingProject && (
                <IDE
                    project={editingProject}
                    onClose={() => setEditingProject(null)}
                    onSaved={() => {
                        setEditingProject(null);
                        loadProjects();
                    }}
                />
            )}

            {showChangePassword && (
                <ChangePasswordModal onClose={() => setShowChangePassword(false)} onSuccess={() => setShowChangePassword(false)} />
            )}
        </div>
    );
};

export default Dashboard;
