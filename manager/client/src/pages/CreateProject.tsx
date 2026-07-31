import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../use-router';
import { api } from '../services';
import ThemeToggle from '../components/ThemeToggle';
import WorkerForm from '../create-project/worker-form';
import PagesForm from '../create-project/pages-form';
import BuildForm from '../create-project/build-form';
import type { SubFormHandle } from '../create-project/types';
import { getErrorMessage } from '../utils/errors';
import { AlertCircle, ArrowLeft, CheckCircle2, Code2, Globe2, Loader2, PackageCheck } from 'lucide-react';
import { useFeedback } from '../contexts/feedback-context';

/** Three modes */
type ProjectMode = 'worker' | 'pages' | 'build';

type ProjectLimitsDraft = {
    cpu: number;
    memoryMb: number;
    diskMb: number;
    uploadMb: number;
    concurrentRequests: number;
    buildTimeoutSeconds: number;
    pids: number;
};

const CreateProject: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { notify } = useFeedback();

    // Shared State
    const [mode, setMode] = useState<ProjectMode>('worker');
    const [name, setName] = useState('');
    const [customPort, setCustomPort] = useState<number | ''>('');
    const [limits, setLimits] = useState<ProjectLimitsDraft>({
        cpu: 1,
        memoryMb: 512,
        diskMb: 512,
        uploadMb: 100,
        concurrentRequests: 32,
        buildTimeoutSeconds: 600,
        pids: 256,
    });
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // 重置表单
    const resetForm = () => {
        setName('');
        setCustomPort('');
        setLimits({
            cpu: 1,
            memoryMb: 512,
            diskMb: 512,
            uploadMb: 100,
            concurrentRequests: 32,
            buildTimeoutSeconds: 600,
            pids: 256,
        });
        setError('');
        setMode('worker');
    };

    // Ref
    const formRef = useRef<SubFormHandle>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        notify(msg, type);
    };

    /** Create Logic */
    const handleCreate = async () => {
        if (!name.trim()) {
            setError(t('createProjectPage.nameEmpty'));
            return;
        }

        const nameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
        const maxNameLength = mode === 'worker' ? 56 : 57;
        if (!nameRegex.test(name) || name.length > maxNameLength) {
            setError(t('createProjectPage.nameInvalid'));
            return;
        }

        if (!formRef.current) {
            setError(t('createProjectPage.formNotReady'));
            return;
        }

        const subPayload = await formRef.current.getPayload();
        if (!subPayload) return;

        setCreating(true);
        setError('');

        try {
            const { _file: fileToUpload, ...projectPayload } = subPayload;

            if (subPayload.type === 'worker' && subPayload.code) {
                const payload = {
                    ...projectPayload,
                    name,
                    port: customPort || undefined,
                    limits,
                };
                await api.post('/projects', payload);
                setSuccessMsg(t('createProjectPage.successMessage', { type: 'Worker' }));
                resetForm();
                setTimeout(() => navigate('/'), 1500);
            } else {
                if (!fileToUpload) throw new Error(t('createProjectPage.missingFile'));
                let payload = { ...projectPayload, name, port: customPort || undefined, limits };
                if (!subPayload.buildId) {
                    const formData = new FormData();
                    formData.append('file', fileToUpload);
                    const uploadRes = await api.post('/upload', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            'X-Project-Upload-Limit-Mb': String(limits.uploadMb)
                        }
                    });
                    payload = { ...payload, mainFile: uploadRes.data.filename };
                }

                await api.post('/projects', payload);
                const typeLabel = subPayload.type === 'worker' ? 'Worker' : 'Pages';
                setSuccessMsg(t('createProjectPage.successMessage', { type: typeLabel }));
                resetForm();
                setTimeout(() => navigate('/'), 1500);
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, t('createProjectPage.error')));
            console.error(err);
            setCreating(false);
        }
    };

    const isCreateDisabled = creating;

    const modes = [
        { id: 'worker' as const, label: t('createProjectPage.worker'), description: t('createProjectPage.workerDesc'), icon: Code2 },
        { id: 'pages' as const, label: t('createProjectPage.pages'), description: t('createProjectPage.pagesDesc'), icon: Globe2 },
        { id: 'build' as const, label: t('createProjectPage.build'), description: t('createProjectPage.buildDesc'), icon: PackageCheck }
    ];

    return (
        <div className="console-page">
            <section className="console-page-header">
                <div>
                    <h1>{t('createProjectPage.title')}</h1>
                    <p>{t('createProjectPage.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle className="icon-button" />
                    <button type="button" onClick={() => navigate('/')} className="console-button secondary">
                        <ArrowLeft size={15} aria-hidden="true" />
                        {t('common.back')}
                    </button>
                </div>
            </section>

            <div className="console-panel overflow-hidden">
                <div className="border-b border-[var(--border-color)] px-4 py-3">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">{t('createProjectPage.step1')}</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3" role="tablist" aria-label={t('createProjectPage.step1')}>
                        {modes.map(({ id, label, description, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={mode === id}
                                onClick={() => setMode(id)}
                                className={`flex min-h-20 items-start gap-3 border px-4 py-3 text-left transition-colors ${mode === id
                                    ? 'border-[var(--primary)] bg-[var(--color-primary-light)]'
                                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]'}`}
                            >
                                <Icon size={18} className={mode === id ? 'mt-0.5 text-[var(--primary)]' : 'mt-0.5 text-[var(--text-muted)]'} />
                                <span>
                                    <span className="block text-sm font-semibold">{label}</span>
                                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-b border-[var(--border-color)] px-4 py-4">
                    <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">{t('createProjectPage.step2')}</p>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label htmlFor="project-name" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('createProjectPage.projectName')}</label>
                            <input
                                id="project-name"
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={mode === 'worker' ? 56 : 57}
                                placeholder={mode === 'worker' ? t('createProjectPage.projectNamePlaceholder.worker') : t('createProjectPage.projectNamePlaceholder.pages')}
                                className="console-input w-full"
                            />
                        </div>
                        <div>
                            <label htmlFor="project-port" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('createProjectPage.internalPort')}</label>
                            <input
                                id="project-port"
                                type="number"
                                min="1024"
                                max="65535"
                                value={customPort}
                                onChange={(event) => setCustomPort(event.target.value ? Number.parseInt(event.target.value, 10) : '')}
                                placeholder={t('createProjectPage.portPlaceholder')}
                                className="console-input w-full"
                            />
                        </div>
                    </div>
                </div>


                <div className="border-t border-[var(--border-color)] px-4 py-4">
                    <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">{t('createProjectPage.limitsTitle')}</p>
                    <p className="mb-3 text-[11px] text-[var(--text-muted)]">{t('createProjectPage.limitsDescription')}</p>
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                        {([
                            ['cpu', 'cpu', '0.1'],
                            ['memoryMb', 'memory', '1'],
                            ['diskMb', 'disk', '1'],
                            ['uploadMb', 'upload', '1'],
                            ['concurrentRequests', 'concurrency', '1'],
                            ['buildTimeoutSeconds', 'buildTimeout', '1'],
                            ['pids', 'pids', '1'],
                        ] as const).map(([key, label, step]) => (
                            <label key={key} className="block text-xs">
                                <span className="mb-1.5 block font-medium text-[var(--text-muted)]">{t(`ide.config.limits.${label}`)}</span>
                                <input
                                    type="number"
                                    min={key === 'cpu' ? 0.1 : 1}
                                    step={step}
                                    value={limits[key]}
                                    onChange={(event) => setLimits(current => ({
                                        ...current,
                                        [key]: key === 'cpu'
                                            ? Number.parseFloat(event.target.value || '0')
                                            : Number.parseInt(event.target.value || '0', 10)
                                    }))}
                                    className="console-input w-full"
                                />
                            </label>
                        ))}
                    </div>
                </div>
                <div className="px-4 py-4">
                    <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">{t('createProjectPage.step3')}</p>
                    {mode === 'worker' && <WorkerForm ref={formRef} setError={setError} showToast={showToast} />}
                    {mode === 'pages' && <PagesForm ref={formRef} setError={setError} showToast={showToast} />}
                    {mode === 'build' && <BuildForm ref={formRef} setError={setError} showToast={showToast} limits={limits} />}
                </div>

                <div className="border-t border-[var(--border-color)] bg-[var(--bg-subtle)] px-4 py-3">
                    {error && (
                        <div role="alert" className="console-alert error mb-3">
                            <AlertCircle size={16} aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button type="button" onClick={() => void handleCreate()} disabled={isCreateDisabled} className="console-button primary min-w-40">
                            {creating && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                            {creating ? t('createProjectPage.deploying') : t('createProjectPage.createDeploy')}
                        </button>
                    </div>
                </div>
            </div>

            {successMsg && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
                    <div role="status" className="console-dialog w-full max-w-sm p-6 text-center">
                        <CheckCircle2 size={30} className="mx-auto text-emerald-500" aria-hidden="true" />
                        <h2 className="mt-3 text-base font-semibold">{t('createProjectPage.success')}</h2>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">{successMsg}</p>
                        <Loader2 size={18} className="mx-auto mt-5 animate-spin text-[var(--primary)]" aria-hidden="true" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateProject;
