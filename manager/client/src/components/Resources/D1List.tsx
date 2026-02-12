import React, { useState, useEffect } from 'react';
import { ResourceService } from '../../services';
import type { D1Database } from '../../types';
import D1Manager from './D1Manager';

const D1List: React.FC = () => {
    const [resources, setResources] = useState<D1Database[]>([]);
    const [loading, setLoading] = useState(false);
    const [managing, setManaging] = useState<{ id: string; name: string } | null>(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        setLoading(true);
        try {
            const data = await ResourceService.getD1();
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
            await ResourceService.createD1(newName);
            setNewName('');
            loadResources();
        } catch (e) { alert('创建失败'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除吗？此操作不可恢复。')) return;
        try {
            await ResourceService.deleteD1(id);
            loadResources();
        } catch (e) { alert('删除失败'); }
    };

    return (
        <div className="neo-card p-6">
            <h2 className="text-xl font-black text-[var(--text-main)] mb-6 flex items-center gap-2">
                <span className="text-purple-500">🗄️</span> D1 Database
            </h2>
            <div className="flex gap-2 mb-6">
                <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Enter database name"
                    className="neo-input flex-1"
                />
                <button
                    onClick={handleCreate}
                    className="btn-gradient px-4 py-2 text-sm"
                >
                    Create
                </button>
            </div>

            {loading ? (
                <div className="text-center text-[var(--text-muted)] py-8 font-medium animate-pulse">Loading databases...</div>
            ) : (
                <div className="space-y-3">
                    {resources.map(r => (
                        <div key={r.id} className="neo-glass p-4 rounded-2xl flex justify-between items-center group hover:border-white/50 bg-white/5 dark:hover:bg-blue-900/40 transition-all border border-transparent hover:border-black/5 dark:hover:border-blue-500/30">
                            <div>
                                <div className="text-[var(--text-main)] font-bold">{r.name}</div>
                                <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5 opacity-60">{r.id}</div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setManaging(r)} className="text-xs btn-glass px-3 py-1.5 h-8 bg-white/50 hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20">Manage</button>
                                <button onClick={() => handleDelete(r.id)} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-xl transition-colors font-bold h-8 flex items-center">Delete</button>
                            </div>
                        </div>
                    ))}
                    {resources.length === 0 && (
                        <div className="text-center py-10 opacity-50">
                            <div className="text-4xl mb-2">🗄️</div>
                            <div className="text-[var(--text-muted)] font-medium">No D1 databases found</div>
                        </div>
                    )}
                </div>
            )}

            {managing && <D1Manager dbId={managing.id} dbName={managing.name} onClose={() => setManaging(null)} />}
        </div>
    );
};

export default D1List;
