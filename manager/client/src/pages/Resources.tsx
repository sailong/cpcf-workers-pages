import React, { useState } from 'react';
import D1List from '../components/Resources/D1List';
import KVList from '../components/Resources/KVList';
import R2List from '../components/Resources/R2List';

type Tab = 'kv' | 'd1' | 'r2';

const Resources: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('kv');

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans">
            {/* Glass Header */}
            <header className="h-16 glass sticky top-0 z-50 flex items-center justify-between px-8 border-b-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                        资源管理
                    </h1>
                </div>
                <button
                    onClick={() => window.location.href = '/'}
                    className="glass-button px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
                >
                    <span>←</span> 返回控制台
                </button>
            </header>

            <div className="max-w-7xl mx-auto p-8">
                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <TabButton
                        active={activeTab === 'kv'}
                        onClick={() => setActiveTab('kv')}
                        icon="📦"
                        label="KV 键值存储"
                    />
                    <TabButton
                        active={activeTab === 'd1'}
                        onClick={() => setActiveTab('d1')}
                        icon="🗄️"
                        label="D1 数据库"
                    />
                    <TabButton
                        active={activeTab === 'r2'}
                        onClick={() => setActiveTab('r2')}
                        icon="🪣"
                        label="R2 存储桶"
                    />
                </div>

                {/* Content Area - Wrapped in a subtle glass container if needed, or just let Lists handle cards */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === 'kv' && <KVList />}
                    {activeTab === 'd1' && <D1List />}
                    {activeTab === 'r2' && <R2List />}
                </div>
            </div>
        </div>
    );
};

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`px-6 py-4 rounded-xl font-bold transition-all flex items-center gap-3 text-sm
            ${active
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-900/20'
                : 'glass-card hover:bg-[#2c2c2e] text-gray-400 border-transparent'
            }`}
    >
        <span className="text-xl">{icon}</span>
        {label}
    </button>
);

export default Resources;
