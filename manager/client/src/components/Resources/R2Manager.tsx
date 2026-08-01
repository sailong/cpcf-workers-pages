import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, HardDrive, Loader2, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { authenticatedFetch } from '../../api';
import { getErrorMessage } from '../../utils/errors';
import { useFeedback } from '../../contexts/feedback-context';

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

interface R2Page {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
}

function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

export default function R2Manager({ bucket, onClose }: R2ManagerProps) {
    const { t } = useTranslation();
    const { confirm, notify } = useFeedback();
    const [files, setFiles] = useState<R2Object[]>([]);
    const [prefix, setPrefix] = useState('');
    const [activePrefix, setActivePrefix] = useState('');
    const [currentCursor, setCurrentCursor] = useState('');
    const [nextCursor, setNextCursor] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pageBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

    const loadPage = useCallback(async (cursor = '', searchPrefix = '') => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ prefix: searchPrefix, limit: '100', delimiter: '' });
            if (cursor) params.set('cursor', cursor);
            const response = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files?${params}`);
            if (!response.ok) throw new Error(await response.text());
            const data: R2Page = await response.json();
            setFiles(data.objects || []);
            setCurrentCursor(cursor);
            setNextCursor(data.truncated ? data.cursor || '' : '');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('r2Manager.loadError')));
        } finally {
            setLoading(false);
        }
    }, [bucket.id, t]);

    useEffect(() => { void loadPage(); }, [loadPage]);

    const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError('');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(await response.text());
            if (fileInputRef.current) fileInputRef.current.value = '';
            await loadPage(currentCursor, activePrefix);
            notify(t('r2Manager.uploadSuccess'), 'success');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('r2Manager.uploadError')));
        } finally {
            setUploading(false);
        }
    };

    const deleteFile = async (key: string) => {
        const accepted = await confirm({
            title: t('common.confirmDelete'),
            message: t('r2Manager.deleteConfirm', { key }),
            confirmLabel: t('common.delete'),
            destructive: true
        });
        if (!accepted) return;
        try {
            const response = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files/${encodeURIComponent(key)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await response.text());
            await loadPage(currentCursor, activePrefix);
            notify(t('r2Manager.deleteSuccess'), 'success');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('r2Manager.deleteError')));
        }
    };

    const search = () => {
        setActivePrefix(prefix);
        setHistory([]);
        void loadPage('', prefix);
    };

    const previousPage = () => {
        const previous = history.at(-1);
        if (previous === undefined) return;
        setHistory(items => items.slice(0, -1));
        void loadPage(previous, activePrefix);
    };

    const nextPage = () => {
        if (!nextCursor) return;
        setHistory(items => [...items, currentCursor]);
        void loadPage(nextCursor, activePrefix);
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 sm:p-5">
            <div className="flex h-[min(840px,94vh)] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
                <header className="flex min-h-16 items-center justify-between border-b border-[var(--border-color)] px-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--r2-theme-light)] text-[var(--r2-theme)]"><HardDrive size={18} /></span>
                        <div className="min-w-0"><h2 className="text-base font-semibold text-[var(--text-main)]">{t('r2Manager.title')}</h2><p className="truncate font-mono text-xs text-[var(--text-muted)]">{bucket.name}</p></div>
                    </div>
                    <button type="button" onClick={onClose} className="icon-button" title={t('common.close')}><X size={17} /></button>
                </header>

                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] p-3">
                    <div className="relative min-w-48 flex-1">
                        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input value={prefix} onChange={event => setPrefix(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') search(); }} placeholder={t('r2Manager.searchPrefix')} className="neo-input h-9 w-full pl-8 text-sm" />
                    </div>
                    <button type="button" onClick={search} className="console-button secondary h-9"><Search size={15} />{t('common.confirm')}</button>
                    <button type="button" onClick={() => void loadPage(currentCursor, activePrefix)} className="icon-button" title={t('common.refresh')}><RefreshCw size={15} /></button>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={uploadFile} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="console-button primary h-9">
                        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{uploading ? t('r2Manager.uploading') : t('r2Manager.upload')}
                    </button>
                </div>

                {error && <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400" role="alert">{error}</div>}

                <main className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full min-w-[720px] table-fixed text-xs">
                        <thead className="sticky top-0 bg-[var(--bg-base)] text-left text-[var(--text-muted)]">
                            <tr>
                                <th className="w-[48%] px-3 py-2 font-medium">{t('r2Manager.key')}</th>
                                <th className="w-28 px-3 py-2 font-medium">{t('r2Manager.size')}</th>
                                <th className="w-48 px-3 py-2 font-medium">{t('r2Manager.uploaded')}</th>
                                <th className="w-24 px-3 py-2 text-right font-medium">{t('r2Manager.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {loading ? <tr><td colSpan={4} className="h-48"><Loader2 size={20} className="mx-auto animate-spin text-[var(--text-muted)]" /></td></tr> : files.length === 0 ? (
                                <tr><td colSpan={4} className="h-48 text-center text-sm text-[var(--text-muted)]">{t('r2Manager.noFiles')}</td></tr>
                            ) : files.map(file => (
                                <tr key={file.key} className="hover:bg-[var(--bg-hover)]">
                                    <td className="truncate px-3 py-2 font-mono text-[var(--text-main)]" title={file.key}>{file.key}</td>
                                    <td className="px-3 py-2 font-mono text-[var(--text-muted)]">{formatSize(file.size)}</td>
                                    <td className="px-3 py-2 text-[var(--text-muted)]">{new Date(file.uploaded).toLocaleString()}</td>
                                    <td className="px-3 py-2"><div className="flex justify-end gap-1">
                                        <a href={`/api/resources/r2/${bucket.id}/files/${encodeURIComponent(file.key)}`} className="icon-button" title={t('r2Manager.download')} download><Download size={15} /></a>
                                        <button type="button" onClick={() => void deleteFile(file.key)} className="icon-button danger" title={t('r2Manager.delete')}><Trash2 size={15} /></button>
                                    </div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </main>

                <footer className="flex min-h-12 items-center justify-between border-t border-[var(--border-color)] px-3 text-xs text-[var(--text-muted)]">
                    <span>{t('r2Manager.pageSummary', { count: files.length, size: formatSize(pageBytes) })}</span>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={previousPage} disabled={history.length === 0} className="icon-button" title={t('resourceList.previous')}><ChevronLeft size={15} /></button>
                        <button type="button" onClick={nextPage} disabled={!nextCursor} className="icon-button" title={t('resourceList.next')}><ChevronRight size={15} /></button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body
    );
}
