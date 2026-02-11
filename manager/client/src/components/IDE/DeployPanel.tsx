import React, { useState } from 'react';
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
    const [uploadType, setUploadType] = useState<'folder' | 'zip' | 'rebuild'>('folder');
    const [files, setFiles] = useState<FileList | null>(null);
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);

    // Build Config
    const [buildCommand, setBuildCommand] = useState('');
    const [outputDir, setOutputDir] = useState('dist');

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
        onLog('开始处理...');

        try {
            if (uploadType === 'rebuild') {
                // Remote Rebuild
                await ProjectService.rebuild(project.id, { buildCommand, outputDir }, onLog);
                onSuccess();
            } else {
                // Upload & Build/Deploy
                let fileToUpload = zipFile;

                if (uploadType === 'folder' && files) {
                    onLog('正在压缩文件...');
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

                if (!fileToUpload) throw new Error("未选择文件");

                onLog('正在上传...');
                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('buildCommand', buildCommand);
                formData.append('outputDir', outputDir);

                const token = localStorage.getItem('auth_token');
                const response = await fetch('/api/build', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let buildId = null;

                if (!reader) throw new Error("连接失败");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.type === 'log') onLog(data.content);
                                if (data.type === 'error') throw new Error(data.content);
                                if (data.type === 'result') buildId = data.buildId;
                            } catch (e) { }
                        }
                    }
                }

                if (buildId) {
                    onLog('构建完成，正在部署...');
                    await ProjectService.deploy(project.id, buildId, outputDir);
                    onLog('部署成功！');
                    onSuccess();
                }

            }
        } catch (e: any) {
            onLog(`错误: ${e.message}`);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="p-6 text-gray-300">
            <div className="flex gap-4 mb-6">
                <button onClick={() => setUploadType('folder')} className={`px-4 py-2 border rounded ${uploadType === 'folder' ? 'border-orange-500 text-orange-400' : 'border-gray-700'}`}>文件夹 (Folder)</button>
                <button onClick={() => setUploadType('zip')} className={`px-4 py-2 border rounded ${uploadType === 'zip' ? 'border-orange-500 text-orange-400' : 'border-gray-700'}`}>Zip 压缩包</button>
                <button onClick={() => setUploadType('rebuild')} className={`px-4 py-2 border rounded ${uploadType === 'rebuild' ? 'border-orange-500 text-orange-400' : 'border-gray-700'}`}>重新构建 (Rebuild)</button>
            </div>

            <div className="border border-dashed border-gray-700 rounded-xl p-8 text-center mb-6">
                {uploadType === 'folder' && (
                    <input type="file"
                        // @ts-ignore
                        webkitdirectory="" directory="" multiple
                        onChange={handleFolderSelect}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                    />
                )}
                {uploadType === 'zip' && (
                    <input type="file" accept=".zip" onChange={handleZipSelect} className="block w-full" />
                )}
                {uploadType === 'rebuild' && (
                    <p>使用上次上传的源代码重新构建。</p>
                )}
            </div>

            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-sm mb-1">构建命令 (Build Command)</label>
                    <input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2" placeholder="npm install && npm run build" />
                </div>
                <div>
                    <label className="block text-sm mb-1">输出目录 (Output Directory)</label>
                    <input value={outputDir} onChange={e => setOutputDir(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2" placeholder="dist" />
                </div>
            </div>

            <button onClick={handleDeploy} disabled={isDeploying} className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded font-bold disabled:opacity-50">
                {isDeploying ? '部署中...' : '开始部署'}
            </button>
        </div>
    );
};

export default DeployPanel;
