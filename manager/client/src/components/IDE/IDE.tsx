import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../types';
import { ProjectService, FileService } from '../../services';
import ConfigPanel from './ConfigPanel';
import DeployPanel from './DeployPanel';
import FileTree from './FileTree';
import Editor from './Editor';
import ReleasesPanel from './ReleasesPanel';
import DeploymentsPanel from './DeploymentsPanel';
import RuntimeLogsPanel from './RuntimeLogsPanel';
import OverviewPanel from './OverviewPanel';
import { useFeedback } from '../../contexts/feedback-context';
import { Activity, ArrowLeft, Boxes, FileCode2, Gauge, Loader2, Rocket, Save, Settings } from 'lucide-react';

interface IDEProps {
    project: Project;
    onClose: () => void;
    onSaved: () => void;
}

type TabType = 'overview' | 'code' | 'deployments' | 'bindings' | 'logs' | 'settings';
type DeploymentView = 'releases' | 'activity' | 'deploy';

const IDE: React.FC<IDEProps> = ({ project, onClose, onSaved }) => {
    const { t } = useTranslation();
    const { notify } = useFeedback();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [deploymentView, setDeploymentView] = useState<DeploymentView>('releases');
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const isPages = project.type === 'pages';

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const loadWorkerCode = useCallback(async () => {
        setLoading(true);
        try {
            const data = await ProjectService.getCode(project.id);
            setCode(data.code);
            // Detect language from mainFile extension or content
            setLanguage(data.language || 'javascript');
        } catch (e) {
            console.error(e);
            notify(t('ide.editor.loadFailed'), 'error');
        } finally {
            setLoading(false);
        }
    }, [notify, project.id, t]);

    const handleFileSelect = useCallback(async (path: string) => {
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
            notify(t('ide.editor.loadFailed'), 'error');
        } finally {
            setLoading(false);
        }
    }, [notify, project.id, t]);

    const handleSaveCode = useCallback(async () => {
        if (isPages) return;
        setSaving(true);
        setSaveSuccess(false);
        try {
            await ProjectService.updateCode(project.id, code);
            onSaved(); // Notify parent for data refresh
            setSaveSuccess(true);
            notify(t('common.saveSuccess'), 'success');
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            console.error(e);
            notify(t('ide.editor.saveFailed'), 'error');
        } finally {
            setSaving(false);
        }
    }, [code, isPages, notify, onSaved, project.id, t]);

    // Initial Load
    useEffect(() => {
        if (!isPages) {
            void loadWorkerCode();
        }
    }, [isPages, loadWorkerCode]);

    // Keyboard shortcut: Ctrl+S / Cmd+S to save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isPages && (e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                void handleSaveCode();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSaveCode, isPages]);

    const tabs = [
        { id: 'overview' as const, label: t('ide.tabs.overview'), icon: Gauge },
        { id: 'code' as const, label: t('ide.tabs.code'), icon: FileCode2 },
        { id: 'deployments' as const, label: t('ide.tabs.deployments'), icon: Activity },
        { id: 'bindings' as const, label: t('ide.tabs.bindings'), icon: Boxes },
        { id: 'logs' as const, label: t('ide.tabs.logs'), icon: Activity },
        { id: 'settings' as const, label: t('ide.tabs.settings'), icon: Settings }
    ];

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-base)] font-sans">
            <header className="z-10 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
                <div className="flex min-h-12 items-center justify-between gap-3 px-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-3">
                    <button type="button" onClick={onClose} className="console-button secondary shrink-0">
                        <ArrowLeft size={15} aria-hidden="true" /> {t('ide.back')}
                    </button>
                    <div className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--text-main)]">{project.name}</span><span className="block truncate font-mono text-[10px] text-[var(--text-muted)]">{project.id}</span></div>
                    <span className={`hidden border px-1.5 py-0.5 text-[10px] sm:inline ${project.type === 'worker'
                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                        : 'border-purple-500/30 bg-purple-500/10 text-purple-500'
                        }`}>
                        {project.type === 'worker' ? t('createProjectPage.worker') : t('createProjectPage.pages')}
                    </span>
                    </div>
                    <span className={`status-badge ${project.status}`}>{project.status === 'running' ? t('dashboardPage.running') : t('dashboardPage.stopped')}</span>
                </div>
                <nav className="flex overflow-x-auto px-2 sm:px-4" role="tablist" aria-label={t('ide.projectNavigation')}>
                    {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={activeTab === id ? 'resource-tab active shrink-0' : 'resource-tab shrink-0'}><Icon size={14} aria-hidden="true" />{label}</button>)}
                </nav>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'overview' && <div className="flex-1 overflow-y-auto"><OverviewPanel project={project} /></div>}

                {activeTab === 'code' && (
                    <>
                        {isPages && (
                            <div className="flex w-40 shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--bg-card)] sm:w-64">
                                <div className="h-9 flex items-center px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-color)] bg-[var(--bg-base)]">
                                    {t('ide.fileTree.explorer')}
                                </div>
                                <FileTree projectId={project.id} onSelect={handleFileSelect} selectedPath={selectedFile} />
                            </div>
                        )}
                        <div className="flex-1 flex flex-col bg-[var(--bg-card)]">
                            {/* Editor Toolbar */}
                            <div className="h-9 border-b border-[var(--border-color)] flex items-center justify-between px-4 bg-[var(--bg-base)]">
                                <div className="flex items-center gap-2 text-xs">
                                    <FileCode2 size={15} className="text-[var(--primary)]" aria-hidden="true" />
                                    <span className="text-[var(--text-muted)] font-mono">{selectedFile || (isPages ? t('ide.editor.selectFilePages') : 'worker.js')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isPages ? (
                                        <>
                                            <span className="text-xs text-[var(--text-muted)]">{t('ide.editor.readOnly')}</span>
                                            <button
                                                type="button"
                                                className="console-button primary"
                                                onClick={() => { setActiveTab('deployments'); setDeploymentView('deploy'); }}
                                            >
                                                <Rocket size={14} aria-hidden="true" /> {t('ide.editor.goToDeploy')}
                                            </button>
                                        </>
                                    ) : saveSuccess && (
                                        <span className="text-xs text-[var(--color-success)] animate-fade-in flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-[var(--color-success)] rounded-full"></span>
                                            {t('ide.editor.saved')}
                                        </span>
                                    )}
                                    {!isPages && <button
                                        type="button"
                                        onClick={handleSaveCode}
                                        disabled={saving}
                                        className="console-button primary"
                                    >
                                        {saving ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> {t('ide.editor.saving')}</> : <><Save size={14} aria-hidden="true" /> {t('ide.editor.save')}</>}
                                    </button>}
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                {loading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)]">
                                        <Loader2 size={24} className="mb-3 animate-spin text-[var(--primary)]" aria-hidden="true" />
                                        {t('ide.editor.loading')}
                                    </div>
                                ) : (
                                    <Editor
                                        code={code}
                                        language={language}
                                        readOnly={isPages}
                                        onChange={(v) => { if (!isPages) setCode(v || ''); }}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'bindings' && (
                    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-4 sm:p-6">
                        <div className="mx-auto max-w-5xl">
                            <ConfigPanel project={project} onSave={onSaved} view="bindings" />
                        </div>
                    </div>
                )}

                {activeTab === 'deployments' && (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-base)]">
                        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border-color)] px-3" role="tablist" aria-label={t('ide.deployments.views')}>
                            {(['releases', 'activity', ...(isPages ? ['deploy'] : [])] as DeploymentView[]).map(view => <button key={view} type="button" role="tab" aria-selected={deploymentView === view} className={deploymentView === view ? 'resource-tab active shrink-0' : 'resource-tab shrink-0'} onClick={() => setDeploymentView(view)}>{t(`ide.deployments.${view}`)}</button>)}
                        </div>
                        {deploymentView === 'releases' && <div className="flex-1 overflow-y-auto"><ReleasesPanel project={project} onChanged={onSaved} /></div>}
                        {deploymentView === 'activity' && <div className="min-h-0 flex-1 overflow-hidden"><DeploymentsPanel project={project} /></div>}
                        {deploymentView === 'deploy' && isPages && <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-4xl"><DeployPanel project={project} onLog={message => setLogs(current => [...current, message])} onSuccess={() => { onSaved(); setDeploymentView('releases'); }} /></div></div>
                            <div className="flex h-52 shrink-0 flex-col border-t border-[var(--border-color)] bg-[#101418] font-mono text-xs">
                                <div className="border-b border-white/10 px-4 py-2 text-[10px] font-semibold uppercase text-slate-400">{t('ide.deploy.buildLogs')}</div>
                                <div className="flex-1 space-y-1 overflow-y-auto p-4 text-slate-300">{logs.map((log, index) => <div key={`${index}:${log}`} className="border-b border-white/5 pb-1">{log}</div>)}{logs.length === 0 && <div className="text-slate-500">{t('ide.deploy.noLogs')}</div>}<div ref={logsEndRef} /></div>
                            </div>
                        </div>}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <RuntimeLogsPanel project={project} />
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-4 sm:p-6"><div className="mx-auto max-w-5xl"><ConfigPanel project={project} onSave={onSaved} view="settings" /></div></div>
                )}
            </div>
        </div>
    );
};

export default IDE;
