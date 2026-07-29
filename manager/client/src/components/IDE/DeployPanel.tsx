import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { ProjectService } from '../../services';
import type { Project } from '../../types';
import { analyzeFiles, analyzeZip } from '../../utils/projectAnalyzer';

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
    const [deployCommand, setDeployCommand] = useState(project.deployCommand || '');

    const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
            const analysis = await analyzeFiles(Array.from(e.target.files));
            if (analysis) {
                if (analysis.buildCommand) setBuildCommand(analysis.buildCommand);
                if (analysis.outputDir) setOutputDir(analysis.outputDir);
                if (analysis.deployCommand) setDeployCommand(analysis.deployCommand);
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
                if (analysis.deployCommand) setDeployCommand(analysis.deployCommand);
            }
        }
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        setDeploySuccess(false);
        setDeployError(null);
        const startTime = new Date().toLocaleTimeString();
        onLog(`[${startTime}] 🚀 ${t('ide.deploy.deploying')}`);

        try {
            if (uploadType === 'rebuild') {
                // Remote Rebuild
                await ProjectService.rebuild(project.id, { buildCommand, outputDir, deployCommand }, onLog);
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
                formData.append('deployCommand', deployCommand);

                const response = await fetch('/api/build', {
                    method: 'POST',
                    credentials: 'same-origin',
                    body: formData
                });

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let buildId = null;

                if (!reader) throw new Error(t('loginPage.connectionFailed'));

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6);
                            let data;
                            try {
                                data = JSON.parse(jsonStr);
                            } catch (e) {
                                continue;
                            }

                            if (data.type === 'log') onLog(data.content);
                            if (data.type === 'error') throw new Error(data.content);
                            if (data.type === 'result') buildId = data.buildId;
                        }
                    }
                }

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
                    onLog(`[${endTime}] ✅ ${t('ide.deploy.deploySuccess')}！`);
                    setDeploySuccess(true);
                    onSuccess();
                }

            }
        } catch (e: any) {
            onLog(`${t('d1Manager.error')} ${e.message}`);
            setDeployError(e.message);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="p-6 text-gray-300">
            {/* 成功/错误提示 Banner */}
            {isDeploying && (
                <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center gap-3 animate-pulse">
                    <span className="text-xl">⏳</span>
                    <span className="font-medium">{t('ide.deploy.deploying')}</span>
                </div>
            )}

            {!isDeploying && deploySuccess && (
                <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="text-xl">✅</span>
                    <div>
                        <div className="font-bold text-sm text-green-300">{t('ide.deploy.deploySuccess')}</div>
                        <div className="text-xs opacity-80">{t('ide.deploy.deploySuccessDesc')}</div>
                    </div>
                </div>
            )}

            {!isDeploying && deployError && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="text-xl">❌</span>
                    <div>
                        <div className="font-bold text-sm text-red-300">{t('ide.deploy.deployFailed')}</div>
                        <div className="text-xs opacity-80">{deployError}</div>
                    </div>
                </div>
            )}

            <div className="flex gap-4 mb-6">
                <button onClick={() => setUploadType('folder')} className={`px-4 py-2 rounded-xl border transition-all ${uploadType === 'folder' ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'border-gray-700 hover:border-gray-500'}`}>{t('ide.deploy.folder')}</button>
                <button onClick={() => setUploadType('zip')} className={`px-4 py-2 rounded-xl border transition-all ${uploadType === 'zip' ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'border-gray-700 hover:border-gray-500'}`}>{t('ide.deploy.zip')}</button>
                <button onClick={() => setUploadType('rebuild')} className={`px-4 py-2 rounded-xl border transition-all ${uploadType === 'rebuild' ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'border-gray-700 hover:border-gray-500'}`}>{t('ide.deploy.rebuild')}</button>
            </div>

            <div className="border border-dashed border-gray-700 rounded-2xl p-8 text-center mb-6 bg-slate-900/20 hover:bg-slate-900/40 transition-colors">
                {uploadType === 'folder' && (
                    <input type="file"
                        // @ts-ignore
                        webkitdirectory="" directory="" multiple
                        onChange={handleFolderSelect}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-600/20 file:text-orange-400 hover:file:bg-orange-600/30 cursor-pointer"
                    />
                )}
                {uploadType === 'zip' && (
                    <input type="file" accept=".zip" onChange={handleZipSelect} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-600/20 file:text-orange-400 hover:file:bg-orange-600/30 cursor-pointer" />
                )}
                {uploadType === 'rebuild' && (
                    <p className="text-gray-400">{t('ide.deploy.rebuildDesc')}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('ide.config.buildCommand')}</label>
                    <input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} className="input-liquid w-full p-3 font-mono text-sm" placeholder="npm install && npm run build" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('ide.config.outputDir')}</label>
                    <input value={outputDir} onChange={e => setOutputDir(e.target.value)} className="input-liquid w-full p-3 font-mono text-sm" placeholder="dist" />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('ide.config.deployCommand')}</label>
                    <input value={deployCommand} onChange={e => setDeployCommand(e.target.value)} className="input-liquid w-full p-3 font-mono text-sm" placeholder="npx wrangler deploy" />
                </div>
            </div>

            <button onClick={handleDeploy} disabled={isDeploying} className="w-full btn-primary py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                {isDeploying ? `🚀 ${t('ide.deploy.deploying')}` : t('ide.deploy.startDeploy')}
            </button>
        </div >
    );
};

export default DeployPanel;
