import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { authenticatedFetch } from '../../api';

interface R2ManagerProps {
    bucket: { id: string; name: string };
    onClose: () => void;
}

interface R2Object {
    key: string;
    size: number;
    etag: string;
    uploaded: string;
}

const R2Manager: React.FC<R2ManagerProps> = ({ bucket, onClose }) => {
    const { t } = useTranslation();
    const [files, setFiles] = useState<R2Object[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadFiles = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files`);
            if (!res.ok) {
                let errorMsg = '加载文件失败';
                try {
                    const text = await res.text();
                    errorMsg += ': ' + text;
                } catch (e) {
                    errorMsg += ' (HTTP ' + res.status + ')';
                }
                throw new Error(errorMsg);
            }
            const data = await res.json();
            // data.objects is the array
            setFiles(data.objects || []);
        } catch (err: any) {
            setError(err.message || t('r2Manager.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [bucket]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error(await res.text());

            await loadFiles();
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
            setError(t('r2Manager.uploadError') + ': ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (key: string) => {
        // Confirmation is implicit or use a nicer modal? 
        // For consistency use window.confirm or custom modal. 
        // D1Manager doesn't seem to use a complex delete modal for rows, but App does for resources.
        // Let's stick to window.confirm for now or simple UI toggle.
        if (!window.confirm(t('r2Manager.deleteConfirm', { key }))) return;

        try {
            const res = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files/${encodeURIComponent(key)}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error(await res.text());
            await loadFiles();
        } catch (err: any) {
            setError(t('r2Manager.deleteError') + ': ' + err.message);
        }
    };

    const getDownloadUrl = (key: string) => `/api/resources/r2/${bucket.id}/files/${key}`;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-8">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
                {/* Header - Yellow Theme */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-[var(--bg-card)]/50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-[var(--r2-theme-light)] text-[var(--r2-theme)] flex items-center justify-center text-xl">
                            🪣
                        </span>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)]">{t('r2Manager.title')}</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">Bucket: <span className="text-[var(--r2-theme)] font-mono">{bucket.name}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: uploading ? 'var(--bg-hover)' : 'var(--r2-theme)',
                                color: uploading ? 'var(--text-muted)' : '#0f172a',
                                boxShadow: uploading ? 'none' : '0 4px 12px rgba(234, 179, 8, 0.25)'
                            }}
                        >
                            {uploading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin"></span>
                                    {t('r2Manager.uploading')}
                                </>
                            ) : (
                                <>
                                    <span>📤</span> {t('r2Manager.upload')}
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--bg-base)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-[var(--bg-base)]">
                    {error && (
                        <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                            ⚠️ {error}
                        </div>
                    )}

                    {loading && files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <div className="w-8 h-8 border-2 border-gray-600 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
                            <p>{t('d1Manager.loading')}</p>
                        </div>
                    ) : (
                        <div className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[var(--bg-card)]/80 text-[var(--text-muted)] font-medium border-b border-[var(--border-color)] uppercase text-xs sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-3 w-1/2">{t('r2Manager.key')}</th>
                                        <th className="px-6 py-3">{t('r2Manager.size')}</th>
                                        <th className="px-6 py-3">{t('r2Manager.uploaded')}</th>
                                        <th className="px-6 py-3 text-right">{t('r2Manager.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {files.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-16 text-center text-gray-600">
                                                <div className="text-4xl mb-4 opacity-30">📭</div>
                                                <p>{t('r2Manager.noFiles')}, {t('r2Manager.uploadHint')}</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        files.map((obj) => (
                                            <tr key={obj.key} className="hover:bg-[var(--bg-base)]/50 group transition-colors">
                                                <td className="px-6 py-4 font-mono text-[var(--text-main)] break-all flex items-center gap-3">
                                                    <span className="opacity-50 text-lg">📄</span>
                                                    {obj.key}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-mono">{formatSize(obj.size)}</td>
                                                <td className="px-6 py-4 text-gray-500 text-xs">
                                                    {new Date(obj.uploaded).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <a
                                                            href={getDownloadUrl(obj.key)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300 text-xs font-medium hover:underline flex items-center gap-1"
                                                            download
                                                        >
                                                            ⬇️ {t('r2Manager.download')}
                                                        </a>
                                                        <button
                                                            onClick={() => handleDelete(obj.key)}
                                                            className="text-red-500 hover:text-red-400 text-xs font-medium hover:underline flex items-center gap-1"
                                                        >
                                                            🗑️ {t('r2Manager.delete')}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-gray-800 bg-gray-900 text-xs text-gray-500 flex justify-between">
                    <span>{t('r2Manager.tips')}</span>
                    <span>{t('r2Manager.fileCount', { count: files.length })}</span>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default R2Manager;
