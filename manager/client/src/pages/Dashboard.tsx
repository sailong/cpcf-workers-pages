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
        <div className="p-8 max-w-7xl mx-auto">
            <header className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-6">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-yellow-500">
                        控制台
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('/resources')} className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-gray-300 transition-colors border border-gray-700">
                            资源管理 (Resources)
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <a href="/create" className="bg-orange-600 px-5 py-2.5 rounded-lg text-white font-bold hover:bg-orange-500 shadow-lg shadow-orange-900/20 transition-all hover:scale-105 active:scale-95">
                        + 新建项目
                    </a>
                    <button onClick={() => setShowChangePassword(true)} className="bg-gray-800 px-4 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors">
                        修改密码
                    </button>
                    <button onClick={handleLogout} className="bg-red-500/10 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                        退出登录
                    </button>
                </div>
            </header>

            <div className="grid gap-4">
                {projects.map(p => (
                    <div key={p.id} className="group bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition-all shadow-sm hover:shadow-md">
                        <div className="flex items-center gap-6">
                            {/* 状态指示器 */}
                            <div className="flex flex-col items-center gap-2 min-w-[60px]">
                                <div className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 ${p.status === 'running'
                                    ? 'border-green-500/30 bg-green-500/10'
                                    : 'border-gray-700 bg-gray-800'
                                    }`}>
                                    <div className={`w-3 h-3 rounded-full ${p.status === 'running'
                                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse'
                                        : 'bg-gray-500'
                                        }`} />
                                </div>
                                <span className={`text-xs font-medium ${p.status === 'running' ? 'text-green-400' : 'text-gray-500'
                                    }`}>
                                    {p.status === 'running' ? '运行中' : '已停止'}
                                </span>
                            </div>

                            {/* 项目信息 */}
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-xl font-bold text-gray-100 group-hover:text-orange-400 transition-colors">
                                        {p.name}
                                    </h3>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${p.type === 'worker'
                                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                                        : 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                                        }`}>
                                        {p.type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-400 font-mono">
                                    <span className="flex items-center gap-1.5">
                                        <span className="text-gray-600">PORT:</span>
                                        <span className="text-gray-300 bg-gray-800 px-1.5 rounded">{p.port}</span>
                                    </span>
                                    <span className="text-gray-700">|</span>
                                    <span className="text-gray-500">ID: {p.id.substring(0, 8)}...</span>
                                </div>
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-3">
                            {p.status === 'running' && (
                                <a href={`http://localhost:${p.port}`} target="_blank" className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 rounded-lg transition-colors font-medium">
                                    <span>打开应用</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                            )}

                            <div className="h-8 w-px bg-gray-800 mx-2"></div>

                            <button onClick={() => toggleProject(p)} className={`px-4 py-2 rounded-lg font-medium transition-colors border ${p.status === 'running'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                                : 'bg-green-600/10 text-green-500 border-green-600/20 hover:bg-green-600/20'
                                }`}>
                                {p.status === 'running' ? '停止' : '启动'}
                            </button>

                            <button onClick={() => setEditingProject(p)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors">
                                编辑
                            </button>

                            <button onClick={() => deleteProject(p.id)} className="px-4 py-2 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/10 rounded-lg transition-colors" title="删除项目">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                ))}

                {projects.length === 0 && (
                    <div className="text-center py-24 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/30">
                        <div className="text-6xl mb-4 opacity-20">🚀</div>
                        <p className="text-xl font-medium mb-2">暂无项目</p>
                        <p className="text-sm opacity-60">点击右上角 "新建项目" 开始您的开发之旅</p>
                    </div>
                )}
            </div>

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
