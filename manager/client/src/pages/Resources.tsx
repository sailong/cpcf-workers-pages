import React, { useState } from 'react';
import D1List from '../components/Resources/D1List';
import KVList from '../components/Resources/KVList';
import R2List from '../components/Resources/R2List';

type Tab = 'kv' | 'd1' | 'r2';

const Resources: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('kv');

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500 mb-6">
                资源管理 (Resource Management)
            </h1>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 mb-6">
                <TabButton
                    active={activeTab === 'kv'}
                    onClick={() => setActiveTab('kv')}
                    icon="📦"
                    label="KV 键值存储"
                    colorClass="text-blue-500"
                />
                <TabButton
                    active={activeTab === 'd1'}
                    onClick={() => setActiveTab('d1')}
                    icon="🗄️"
                    label="D1 数据库"
                    colorClass="text-purple-500"
                />
                <TabButton
                    active={activeTab === 'r2'}
                    onClick={() => setActiveTab('r2')}
                    icon="🪣"
                    label="R2 存储桶"
                    colorClass="text-yellow-500"
                />
            </div>

            {/* Content using a keep-alive approach or conditional rendering */}
            <div className="mt-4">
                {activeTab === 'kv' && <KVList />}
                {activeTab === 'd1' && <D1List />}
                {activeTab === 'r2' && <R2List />}
            </div>
        </div>
    );
};

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
    colorClass: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label, colorClass }) => (
    <button
        onClick={onClick}
        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2
            ${active
                ? `border-blue-500 text-gray-200 bg-gray-900/50`
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-900/30'
            }`}
    >
        <span className={active ? colorClass : ''}>{icon}</span>
        {label}
    </button>
);

export default Resources;
