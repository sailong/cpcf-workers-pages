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
        <div className="min-h-screen font-sans transition-colors duration-300">
            <div className="max-w-7xl mx-auto p-6 md:p-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tight">Resources</h1>
                        <p className="text-[var(--text-muted)] mt-1 font-medium">Manage your KV, D1, and R2 storage.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="btn-glass px-4 py-2 text-sm"
                        >
                            <span>← Back</span>
                        </button>

                        <div className="h-8 w-px bg-current opacity-10 mx-2"></div>

                        <div className="flex items-center gap-2 bg-white/10 p-1 rounded-2xl border border-white/20 backdrop-blur-md">
                            <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-white/20 transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
                                {theme === 'dark' ? '🌙' : '☀️'}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Tabs - Neo-Glass Style */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                    <TabButton
                        active={activeTab === 'kv'}
                        onClick={() => setActiveTab('kv')}
                        icon="📦"
                        label="KV Storage"
                    />
                    <TabButton
                        active={activeTab === 'd1'}
                        onClick={() => setActiveTab('d1')}
                        icon="🗄️"
                        label="D1 Database"
                    />
                    <TabButton
                        active={activeTab === 'r2'}
                        onClick={() => setActiveTab('r2')}
                        icon="🪣"
                        label="R2 Bucket"
                    />
                </div>

                {/* Content Area */}
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
        className={`px-1 py-1 rounded-full font-bold transition-all flex items-center gap-2 text-sm min-w-[140px] justify-center
            ${active
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105 border border-white/10'
                : 'border border-white/20 text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-sm hover:shadow-md dark:bg-white/5 dark:border-white/50 dark:hover:bg-white/10 dark:text-gray-100'
            }`}
    >
        <span className="text-xl">{icon}</span>
        {label}
    </button>
);

export default Resources;
