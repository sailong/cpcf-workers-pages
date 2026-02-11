import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import D1List from '../components/Resources/D1List';
import KVList from '../components/Resources/KVList';
import R2List from '../components/Resources/R2List';

type Tab = 'kv' | 'd1' | 'r2';

const Resources: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<Tab>('kv');

    return (
        <div className="min-h-screen p-6 md:p-10 font-sans transition-colors duration-300">
            <header className="max-w-7xl mx-auto flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">资源管理</h1>
                    <p className="text-muted-foreground text-sm mt-1">管理您的 KV, D1 和 R2 存储单元</p>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="glass-button px-5 py-2.5 rounded-xl font-medium flex items-center gap-2">
                        <span className="text-lg">⬅️</span>
                        <span>返回控制台</span>
                    </button>

                    <div className="h-6 w-px bg-current opacity-10 mx-2"></div>

                    <button
                        onClick={toggleTheme}
                        className="opacity-60 hover:opacity-100 transition-all p-2"
                        title={theme === 'dark' ? '切换亮色' : '切换暗色'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M6.343 6.343l.707-.707" />
                                <circle cx="12" cy="12" r="4" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>
                </div>
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
                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30 shadow-lg shadow-blue-500/10'
                : 'glass border-transparent hover:bg-current/5 opacity-60'
            }`}
    >
        <span className="text-xl">{icon}</span>
        {label}
    </button>
);

export default Resources;
