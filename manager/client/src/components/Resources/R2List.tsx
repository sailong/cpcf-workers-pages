import React, { useState, useEffect } from 'react';
import { ResourceService } from '../../services';
import type { R2Bucket } from '../../types';
import R2Manager from './R2Manager';

const R2List: React.FC = () => {
    const [resources, setResources] = useState<R2Bucket[]>([]);
    const [loading, setLoading] = useState(false);
    const [managing, setManaging] = useState<{ id: string; name: string } | null>(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        setLoading(true);
        try {
            const data = await ResourceService.getR2();
            setResources(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName) return;
        try {
            await ResourceService.createR2(newName);
            setNewName('');
            loadResources();
        } catch (e) { alert('创建失败'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除吗？此操作不可恢复。')) return;
        try {
            await ResourceService.deleteR2(id);
            loadResources();
        } catch (e) { alert('删除失败'); }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2">
                <span className="text-yellow-500">🪣</span> R2 存储桶
            </h2>
            <div className="flex gap-2 mb-4">
                <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="输入存储桶名称"
                    className="flex-1 bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
                />
                <button
                    onClick={handleCreate}
                    className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded text-sm text-white"
                >
                    创建
                </button>
            </div>

            {loading ? (
                <div className="text-center text-gray-500 py-4">加载中...</div>
            ) : (
                <div className="space-y-2">
                    {resources.map(r => (
                        <div key={r.id} className="bg-gray-800 p-3 rounded flex justify-between items-center group hover:bg-gray-750 transition-colors">
                            <div>
                                <div className="text-gray-200 text-sm font-medium">{r.name}</div>
                                <div className="text-xs text-gray-500 font-mono">{r.id}</div>
                            </div>
                            <div className="flex gap-2 opacity-80 group-hover:opacity-100">
                                <button onClick={() => setManaging(r)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300">管理</button>
                                <button onClick={() => handleDelete(r.id)} className="text-xs bg-red-900/50 hover:bg-red-900 text-red-400 px-2 py-1 rounded">删除</button>
                            </div>
                        </div>
                    ))}
                    {resources.length === 0 && <div className="text-center text-gray-600 text-sm py-4">暂无 R2 存储桶</div>}
                </div>
            )}

            {managing && <R2Manager bucket={managing} onClose={() => setManaging(null)} />}
        </div>
    );
};

export default R2List;
