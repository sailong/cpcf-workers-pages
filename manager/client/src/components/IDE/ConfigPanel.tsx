import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project, Bindings, EnvVars, JsonValue, ProjectLimits, Resources } from '../../types';
import { ProjectService, ResourceService } from '../../services';
import { useFeedback } from '../../contexts/feedback-context';
import { CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2, TriangleAlert } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

interface ConfigPanelProps {
    project: Project;
    onSave: () => void;
    view: 'bindings' | 'settings';
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ project, onSave, view }) => {
    const { t } = useTranslation();
    const { notify } = useFeedback();
    const [bindings, setBindings] = useState<Bindings>({ kv: [], d1: [], r2: [] });
    const [envVars, setEnvVars] = useState<EnvVars>({});
    const [port, setPort] = useState<number>(0);
    const [buildCommand, setBuildCommand] = useState('');
    const [outputDir, setOutputDir] = useState('');
    const [compatibilityDate, setCompatibilityDate] = useState(project.compatibilityDate);
    const [compatibilityFlagsText, setCompatibilityFlagsText] = useState(project.compatibilityFlags.join(', '));
    const [limits, setLimits] = useState<ProjectLimits>(project.limits);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [resourceLoadError, setResourceLoadError] = useState('');

    const [resources, setResources] = useState<Resources>({ kv: [], d1: [], r2: [] });

    const loadConfig = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const projects = await ProjectService.getAll();
            const current = projects.find(p => p.id === project.id);
            if (!current) throw new Error(t('ide.config.projectMissing'));
            setBindings(current.bindings || { kv: [], d1: [], r2: [] });
            setEnvVars(current.envVars || {});
            setPort(current.port);
            setBuildCommand(current.buildCommand || '');
            setOutputDir(current.outputDir || '');
            setCompatibilityDate(current.compatibilityDate);
            setCompatibilityFlagsText(current.compatibilityFlags.join(', '));
            setLimits(current.limits);
        } catch (error) {
            const message = getErrorMessage(error, t('ide.config.loadFailed'));
            setLoadError(message);
            notify(message, 'error');
        } finally {
            setLoading(false);
        }
    }, [notify, project.id, t]);

    const loadResources = useCallback(async () => {
        setResourceLoadError('');
        try {
            const [kv, d1, r2] = await Promise.all([
                ResourceService.getKV(),
                ResourceService.getD1(),
                ResourceService.getR2()
            ]);
            setResources({ kv, d1, r2 });
        } catch (error) {
            const message = getErrorMessage(error, t('ide.config.resourceLoadFailed'));
            setResourceLoadError(message);
            notify(message, 'error');
        }
    }, [notify, t]);

    useEffect(() => {
        void loadConfig();
        if (view === 'bindings') void loadResources();
    }, [loadConfig, loadResources, view]);

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            await ProjectService.updateConfig(project.id, {
                bindings,
                envVars,
                port,
                buildCommand,
                outputDir,
                compatibilityDate,
                compatibilityFlags: compatibilityFlagsText.split(',').map(flag => flag.trim()).filter(Boolean),
                limits
            });
            onSave();
            setSaveSuccess(true);
            notify(t('common.saveSuccess'), 'success');
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            notify(getErrorMessage(error, t('common.saveFailed')), 'error');
        } finally {
            setSaving(false);
        }
    };

    const addBinding = (type: 'kv' | 'd1' | 'r2') => {
        setBindings(prev => ({
            ...prev,
            [type]: [...prev[type], { varName: '', resourceId: '' }]
        }));
    };

    const updateBinding = (type: 'kv' | 'd1' | 'r2', index: number, field: 'varName' | 'resourceId', value: string) => {
        setBindings(current => ({
            ...current,
            [type]: current[type].map((binding, bindingIndex) => bindingIndex === index
                ? { ...binding, [field]: value }
                : binding)
        }));
    };

    const removeBinding = (type: 'kv' | 'd1' | 'r2', index: number) => {
        setBindings(current => ({
            ...current,
            [type]: current[type].filter((_, bindingIndex) => bindingIndex !== index)
        }));
    };

    const updateLimit = (key: keyof ProjectLimits, value: string) => {
        setLimits(current => ({ ...current, [key]: Number(value) }));
    };

    if (loading) return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 size={17} className="animate-spin" />{t('ide.config.loading')}</div>;
    if (loadError) return <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 border border-red-500/25 bg-red-500/10 p-6 text-center text-sm text-[var(--color-danger)]"><TriangleAlert size={20} aria-hidden="true" /><span>{loadError}</span><button type="button" className="console-button secondary" onClick={() => void loadConfig()}><RefreshCw size={14} aria-hidden="true" />{t('common.retry')}</button></div>;

    return (
        <div className="space-y-6">
            {view === 'bindings' ? <>
            {resourceLoadError && <div role="alert" className="flex items-center justify-between gap-3 border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-[var(--color-danger)]"><span className="flex min-w-0 items-center gap-2"><TriangleAlert size={16} className="shrink-0" aria-hidden="true" /><span>{resourceLoadError}</span></span><button type="button" className="console-button secondary shrink-0" onClick={() => void loadResources()}><RefreshCw size={14} aria-hidden="true" />{t('common.retry')}</button></div>}
            {/* Bindings Section */}
            <div>
                <h2 className="mb-1 text-sm font-semibold text-[var(--text-main)]">{t('ide.config.bindings')}</h2>
                <p className="mb-4 text-xs text-[var(--text-muted)]">{t('ide.config.bindingsDescription')}</p>

                {/* KV */}
                <div className="mb-5 border-t border-[var(--border-color)] pt-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[var(--text-main)]">{t('ide.config.kvBinding')}</h3>
                        <button type="button" onClick={() => addBinding('kv')} className="console-button secondary"><Plus size={14} />{t('common.add')}</button>
                    </div>
                    {bindings.kv.map((b, i) => (
                        <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,2fr)_2.25rem]">
                            <input
                                className="console-input w-full font-mono"
                                aria-label={t('ide.config.variableName')}
                                placeholder={t('ide.config.variableName')}
                                value={b.varName}
                                onChange={e => updateBinding('kv', i, 'varName', e.target.value)}
                            />
                            <select
                                className="console-input w-full"
                                aria-label={t('ide.config.selectKV')}
                                value={b.resourceId}
                                onChange={e => updateBinding('kv', i, 'resourceId', e.target.value)}
                            >
                                <option value="">{t('ide.config.selectKV')}</option>
                                {resources.kv.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <button type="button" onClick={() => removeBinding('kv', i)} className="console-icon-button text-red-500" title={t('common.delete')}><Trash2 size={15} /></button>
                        </div>
                    ))}
                </div>

                {/* D1 */}
                <div className="mb-5 border-t border-[var(--border-color)] pt-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[var(--text-main)]">{t('ide.config.d1Binding')}</h3>
                        <button type="button" onClick={() => addBinding('d1')} className="console-button secondary"><Plus size={14} />{t('common.add')}</button>
                    </div>
                    {bindings.d1.map((b, i) => (
                        <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,2fr)_2.25rem]">
                            <input
                                className="console-input w-full font-mono"
                                aria-label={t('ide.config.variableName')}
                                placeholder={t('ide.config.variableName')}
                                value={b.varName}
                                onChange={e => updateBinding('d1', i, 'varName', e.target.value)}
                            />
                            <select
                                className="console-input w-full"
                                aria-label={t('ide.config.selectD1')}
                                value={b.resourceId}
                                onChange={e => updateBinding('d1', i, 'resourceId', e.target.value)}
                            >
                                <option value="">{t('ide.config.selectD1')}</option>
                                {resources.d1.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <button type="button" onClick={() => removeBinding('d1', i)} className="console-icon-button text-red-500" title={t('common.delete')}><Trash2 size={15} /></button>
                        </div>
                    ))}
                </div>

                {/* R2 */}
                <div className="mb-5 border-t border-[var(--border-color)] pt-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[var(--text-main)]">{t('ide.config.r2Binding')}</h3>
                        <button type="button" onClick={() => addBinding('r2')} className="console-button secondary"><Plus size={14} />{t('common.add')}</button>
                    </div>
                    {bindings.r2.map((b, i) => (
                        <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,2fr)_2.25rem]">
                            <input
                                className="console-input w-full font-mono"
                                aria-label={t('ide.config.variableName')}
                                placeholder={t('ide.config.variableName')}
                                value={b.varName}
                                onChange={e => updateBinding('r2', i, 'varName', e.target.value)}
                            />
                            <select
                                className="console-input w-full"
                                aria-label={t('ide.config.selectR2')}
                                value={b.resourceId}
                                onChange={e => updateBinding('r2', i, 'resourceId', e.target.value)}
                            >
                                <option value="">{t('ide.config.selectR2')}</option>
                                {resources.r2.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <button type="button" onClick={() => removeBinding('r2', i)} className="console-icon-button text-red-500" title={t('common.delete')}><Trash2 size={15} /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Environment Variables */}
            <div className="border-t border-[var(--border-color)] pt-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div><h2 className="text-sm font-semibold text-[var(--text-main)]">{t('ide.config.envVars')}</h2><p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('ide.config.envDescription')}</p></div>
                    <button
                        type="button"
                        onClick={() => {
                            const newKey = `VAR_${Object.keys(envVars).length + 1}`;
                            setEnvVars({ ...envVars, [newKey]: { type: 'plain', value: '' } });
                        }}
                        className="console-button secondary"
                    >
                        <Plus size={14} />{t('ide.config.addVar')}
                    </button>
                </div>

                {Object.entries(envVars).map(([key, config], i) => (
                    <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[minmax(8rem,1fr)_7rem_minmax(10rem,2fr)_2.25rem]">
                        <input
                            className="console-input w-full font-mono"
                            placeholder={t('ide.config.key')}
                            value={key}
                            onChange={e => {
                                const newKey = e.target.value;
                                if (newKey !== key) {
                                    const newEnv = { ...envVars };
                                    const val = newEnv[key];
                                    delete newEnv[key];
                                    newEnv[newKey] = val;
                                    setEnvVars(newEnv);
                                }
                            }}
                        />
                        <select
                            className="console-input w-full"
                            value={config.type}
                            onChange={e => {
                                setEnvVars({
                                    ...envVars,
                                    [key]: { ...config, type: e.target.value as EnvVars[string]['type'] }
                                });
                            }}
                        >
                            <option value="plain">{t('ide.config.typeText')}</option>
                            <option value="secret">{t('ide.config.typeSecret')}</option>
                            <option value="json">{t('ide.config.typeJson')}</option>
                        </select>
                        <input
                            type={config.type === 'secret' ? 'password' : 'text'}
                            className="console-input w-full font-mono"
                            placeholder={t('ide.config.value')}
                            value={typeof config.value === 'string' ? config.value : JSON.stringify(config.value)}
                            onChange={e => {
                                let val: JsonValue = e.target.value;
                                if (config.type === 'json') {
                                    try {
                                        val = JSON.parse(e.target.value);
                                    } catch {
                                        val = e.target.value;
                                    }
                                }
                                setEnvVars({
                                    ...envVars,
                                    [key]: { ...config, value: val }
                                });
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newEnv = { ...envVars };
                                delete newEnv[key];
                                setEnvVars(newEnv);
                            }}
                            className="console-icon-button text-red-500"
                            title={t('common.delete')}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                ))}
                {Object.keys(envVars).length === 0 && (
                    <div className="border border-dashed border-[var(--border-color)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">{t('ide.config.noEnvVars')}</div>
                )}
            </div>
            </> : <>
            <div>
                <h2 className="mb-4 text-sm font-semibold text-[var(--text-main)]">{t('ide.config.buildSettings')}</h2>

                <div className="mb-5 grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('ide.config.port')}</label>
                        <input
                            type="number"
                            value={port}
                            onChange={e => setPort(Number.parseInt(e.target.value, 10) || 0)}
                            className="console-input w-full font-mono"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('ide.config.outputDir')}</label>
                        <input
                            type="text"
                            value={outputDir}
                            onChange={e => setOutputDir(e.target.value)}
                            placeholder="dist"
                            className="console-input w-full font-mono"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('ide.config.buildCommand')}</label>
                        <input
                            type="text"
                            value={buildCommand}
                            onChange={e => setBuildCommand(e.target.value)}
                            placeholder="npm ci && npm run build"
                            className="console-input w-full font-mono"
                        />
                    </div>
                </div>
            </div>

            <div className="border-t border-[var(--border-color)] pt-6">
                <h3 className="mb-1 text-base font-semibold text-[var(--text-main)]">{t('ide.config.compatibility.title')}</h3>
                <p className="mb-4 text-xs text-[var(--text-muted)]">{t('ide.config.compatibility.description')}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs text-[var(--text-muted)]">
                        <span className="mb-1.5 block font-medium">{t('ide.config.compatibility.date')}</span>
                        <input
                            type="date"
                            value={compatibilityDate}
                            onChange={event => setCompatibilityDate(event.target.value)}
                            className="console-input w-full font-mono"
                        />
                    </label>
                    <label className="block text-xs text-[var(--text-muted)]">
                        <span className="mb-1.5 block font-medium">{t('ide.config.compatibility.flags')}</span>
                        <input
                            type="text"
                            value={compatibilityFlagsText}
                            onChange={event => setCompatibilityFlagsText(event.target.value)}
                            placeholder="nodejs_compat"
                            className="console-input w-full font-mono"
                        />
                    </label>
                </div>
            </div>

            <div className="border-t border-[var(--border-color)] pt-6">
                <h3 className="text-base font-semibold text-[var(--text-main)] mb-1">{t('ide.config.limits.title')}</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">{t('ide.config.limits.description')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {([
                        ['cpu', 'cpu', '0.1'],
                        ['memoryMb', 'memory', '1'],
                        ['diskMb', 'disk', '1'],
                        ['uploadMb', 'upload', '1'],
                        ['concurrentRequests', 'concurrency', '1'],
                        ['buildTimeoutSeconds', 'buildTimeout', '1'],
                        ['pids', 'pids', '1']
                    ] as const).map(([key, label, step]) => (
                        <label key={key} className="block text-xs text-[var(--text-muted)]">
                            <span className="block mb-1.5 font-medium">{t(`ide.config.limits.${label}`)}</span>
                            <input
                                type="number"
                                min={step}
                                step={step}
                                value={limits[key]}
                                onChange={event => updateLimit(key, event.target.value)}
                                className="console-input w-full font-mono"
                            />
                        </label>
                    ))}
                </div>
            </div>
            </>}

            <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--border-color)] bg-[var(--bg-base)] py-3">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="console-button primary"
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? t('common.saving') : t('common.save')}
                </button>
                {saveSuccess && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-500">
                        <CheckCircle2 size={15} />
                        {t('common.saved')}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ConfigPanel;
