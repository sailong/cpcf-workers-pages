import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { ProjectService } from '../../services';
import type { Project } from '../../types';
import { analyzeFiles, analyzeZip } from '../../utils/projectAnalyzer';
import { getErrorMessage } from '../../utils/errors';
import { consumeSSE } from '../../utils/sse-stream';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface DeployPanelProps {
    project: Project;
    onLog: (msg: string) => void;
    onSuccess: () => void;
}

const DeployPanel: React.FC<DeployPanelProps> = ({ project, onLog, onSuccess }) => {
    const { t } = useTranslation();
    const [uploadType, setUploadType] = useState<'folder' | 'zip' | 'rebuild'>('folder');
    const [files, setFiles] = useState<FileList | null>(null);
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploySuccess, setDeploySuccess] = useState(false);
    const [deployError, setDeployError] = useState<string | null>(null);

    // Build Config - Load from project initially
    const [buildCommand, setBuildCommand] = useState(project.buildCommand || '');
    const [outputDir, setOutputDir] = useState(project.outputDir || 'dist');

    const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
            const analysis = await analyzeFiles(Array.from(e.target.files));
            if (analysis) {
                if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
                if (analysis.outputDir) setOutputDir(analysis.outputDir);
            }
        }
    };

    const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setZipFile(e.target.files[0]);
            const analysis = await analyzeZip(e.target.files[0]);
            if (analysis) {
                if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
                if (analysis.outputDir) setOutputDir(analysis.outputDir);
            }
        }
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        setDeploySuccess(false);
        setDeployError(null);
        const startTime = new Date().toLocaleTimeString();
        onLog(`[${startTime}] ${t('ide.deploy.deploying')}`);

        try {
            if (uploadType === 'rebuild') {
                await ProjectService.rebuild(project.id, { buildCommand, outputDir }, onLog);
                setDeploySuccess(true);
                onSuccess();
            } else {
                // Upload & Build/Deploy
                let fileToUpload = zipFile;

                if (uploadType === 'folder' && files) {
                    onLog(t('pagesForm.processing'));
                    const zip = new JSZip();
                    const fileArray = Array.from(files);
                    if (fileArray.length > 0) {
                        const firstPathParts = fileArray[0].webkitRelativePath.split('/');
                        if (firstPathParts.length > 1) {
                            const candidateRoot = firstPathParts[0] + '/';
                            const hasCommonRoot = fileArray.every(f => f.webkitRelativePath.startsWith(candidateRoot));
                            if (hasCommonRoot) {
                                fileArray.forEach(file => {
                                    const cleanPath = file.webkitRelativePath.substring(candidateRoot.length);
                                    if (cleanPath) zip.file(cleanPath, file);
                                });
                            } else {
                                fileArray.forEach(file => zip.file(file.webkitRelativePath, file));
                            }
                        } else {
                            fileArray.forEach(file => zip.file(file.webkitRelativePath, file));
                        }
                    }
                    const content = await zip.generateAsync({ type: "blob" });
                    fileToUpload = new File([content], "update.zip", { type: "application/zip" });
                }

                if (!fileToUpload) throw new Error(t('createProjectPage.missingFile'));

                onLog(t('r2Manager.uploading'));
                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('buildCommand', buildCommand);
                formData.append('outputDir', outputDir);

                const response = await fetch('/api/build', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'X-Project-Id': project.id },
                    body: formData
                });

                const result = await consumeSSE(response, message => {
                    if (message.type === 'log') onLog(String(message.content || ''));
                    if (message.type === 'error') throw new Error(String(message.content || t('ide.deploy.deployFailed')));
                    return message.type === 'result';
                });
                const buildId = typeof result?.buildId === 'string' ? result.buildId : null;
                if (!buildId) throw new Error(t('ide.deploy.missingBuildResult'));

                if (buildId) {
                    onLog(t('ide.deploy.deploying'));
                    await ProjectService.deploy(
                        project.id,
                        buildId,
                        outputDir,
                        onLog,
                        (err) => { throw new Error(err); }
                    );
                    const endTime = new Date().toLocaleTimeString();
                    onLog(`[${endTime}] ${t('ide.deploy.deploySuccess')}`);
                    setDeploySuccess(true);
                    onSuccess();
                }

            }
        } catch (error: unknown) {
            const message = getErrorMessage(error, t('ide.deploy.deployFailed'));
            onLog(`${t('d1Manager.error')} ${message}`);
            setDeployError(message);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="text-[var(--text-main)]">
            {isDeploying && (
                <div className="console-alert info mb-5">
                    <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                    <span className="font-medium">{t('ide.deploy.deploying')}</span>
                </div>
            )}

            {!isDeploying && deploySuccess && (
                <div className="console-alert success mb-5">
                    <CheckCircle2 size={17} aria-hidden="true" />
                    <div>
                        <div className="text-sm font-semibold">{t('ide.deploy.deploySuccess')}</div>
                        <div className="text-xs">{t('ide.deploy.deploySuccessDesc')}</div>
                    </div>
                </div>
            )}

            {!isDeploying && deployError && (
                <div className="console-alert error mb-5">
                    <XCircle size={17} aria-hidden="true" />
                    <div>
                        <div className="text-sm font-semibold">{t('ide.deploy.deployFailed')}</div>
                        <div className="text-xs">{deployError}</div>
                    </div>
                </div>
            )}

            <div className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border-color)]" role="tablist" aria-label={t('ide.deploy.sourceType')}>
                {(['folder', 'zip', 'rebuild'] as const).map(type => <button key={type} type="button" role="tab" aria-selected={uploadType === type} onClick={() => setUploadType(type)} className={uploadType === type ? 'resource-tab active shrink-0' : 'resource-tab shrink-0'}>{t(`ide.deploy.${type}`)}</button>)}
            </div>

            <div className="mb-5 border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] p-5 text-center">
                {uploadType === 'folder' && (
                    <input type="file"
                        {...{ webkitdirectory: '', directory: '' }} multiple
                        onChange={handleFolderSelect}
                        className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:border file:border-[var(--border-color)] file:bg-[var(--bg-base)] file:px-3 file:py-2 file:text-sm file:text-[var(--text-main)]"
                    />
                )}
                {uploadType === 'zip' && (
                    <input type="file" accept=".zip" onChange={handleZipSelect} className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:border file:border-[var(--border-color)] file:bg-[var(--bg-base)] file:px-3 file:py-2 file:text-sm file:text-[var(--text-main)]" />
                )}
                {uploadType === 'rebuild' && (
                    <p className="text-sm text-[var(--text-muted)]">{t('ide.deploy.rebuildDesc')}</p>
                )}
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('ide.config.buildCommand')}</label>
                    <input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} className="console-input w-full font-mono" placeholder="npm ci && npm run build" />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('ide.config.outputDir')}</label>
                    <input value={outputDir} onChange={e => setOutputDir(e.target.value)} className="console-input w-full font-mono" placeholder="dist" />
                </div>
            </div>

            <button type="button" onClick={() => void handleDeploy()} disabled={isDeploying} className="console-button primary w-full justify-center">
                {isDeploying && <Loader2 size={15} className="animate-spin" />}{isDeploying ? t('ide.deploy.deploying') : t('ide.deploy.startDeploy')}
            </button>
        </div >
    );
};

export default DeployPanel;
