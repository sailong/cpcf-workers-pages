import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Braces, Database, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import D1List from '../components/Resources/D1List';
import KVList from '../components/Resources/KVList';
import R2List from '../components/Resources/R2List';

type Tab = 'kv' | 'd1' | 'r2';

interface TabConfig {
    id: Tab;
    label: string;
    icon: LucideIcon;
}

const Resources: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('kv');
    const tabs: TabConfig[] = [
        { id: 'kv', label: t('resourcesPage.kvStorage'), icon: Braces },
        { id: 'd1', label: t('resourcesPage.d1Database'), icon: Database },
        { id: 'r2', label: t('resourcesPage.r2Bucket'), icon: HardDrive }
    ];

    return (
        <div className="console-page">
            <section className="console-page-header">
                <div>
                    <h1>{t('resources')}</h1>
                    <p>{t('resourcesPage.subtitle')}</p>
                </div>
            </section>

            <div className="mb-4 flex items-start gap-3 border-y border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-[var(--text-muted)]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                <div>
                    <strong className="mr-2 font-semibold text-[var(--text-main)]">{t('resourcesPage.localRuntime')}</strong>
                    {t('resourcesPage.localRuntimeDetail')}
                </div>
            </div>

            <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border-color)]" role="tablist" aria-label={t('resources')}>
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={activeTab === tab.id ? 'resource-tab active' : 'resource-tab'}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={16} aria-hidden="true" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div role="tabpanel">
                {activeTab === 'kv' && <KVList />}
                {activeTab === 'd1' && <D1List />}
                {activeTab === 'r2' && <R2List />}
            </div>
        </div>
    );
};

export default Resources;
