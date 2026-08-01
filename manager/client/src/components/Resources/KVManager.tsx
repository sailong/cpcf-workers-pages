import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Braces, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { authenticatedFetch } from '../../api';
import { getErrorMessage } from '../../utils/errors';
import { useFeedback } from '../../contexts/feedback-context';

interface KVManagerProps {
    namespace: { id: string; name: string };
    onClose: () => void;
}

interface KVKey {
    name: string;
    expiration?: number;
    metadata?: unknown;
}

interface KeyPage {
    keys: KVKey[];
    list_complete: boolean;
    cursor?: string;
}

function toLocalDateTime(expiration?: number) {
    if (!expiration) return '';
    const date = new Date(expiration * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function KVManager({ namespace, onClose }: KVManagerProps) {
    const { t } = useTranslation();
    const { confirm, notify } = useFeedback();
    const [keys, setKeys] = useState<KVKey[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [keyName, setKeyName] = useState('');
    const [value, setValue] = useState('');
    const [metadata, setMetadata] = useState('');
    const [expiration, setExpiration] = useState('');
    const [prefix, setPrefix] = useState('');
    const [activePrefix, setActivePrefix] = useState('');
    const [currentCursor, setCurrentCursor] = useState('');
    const [nextCursor, setNextCursor] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadPage = useCallback(async (cursor = '', searchPrefix = '') => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ limit: '100', prefix: searchPrefix });
            if (cursor) params.set('cursor', cursor);
            const response = await authenticatedFetch(`/api/resources/kv/${namespace.id}/keys?${params}`);
            if (!response.ok) throw new Error((await response.json()).error || t('kvManager.loadKeysError'));
            const data: KeyPage = await response.json();
            setKeys(data.keys || []);
            setCurrentCursor(cursor);
            setNextCursor(data.list_complete ? '' : data.cursor || '');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('kvManager.loadKeysError')));
        } finally {
            setLoading(false);
        }
    }, [namespace.id, t]);

    useEffect(() => { void loadPage(); }, [loadPage]);

    const selectKey = async (key: KVKey) => {
        setError('');
        try {
            const response = await authenticatedFetch(`/api/resources/kv/${namespace.id}/values/${encodeURIComponent(key.name)}`);
            if (!response.ok) throw new Error((await response.json()).error || t('kvManager.loadValueError'));
            const data = await response.json();
            setSelectedKey(key.name);
            setKeyName(key.name);
            setValue(typeof data.value === 'string' ? data.value : JSON.stringify(data.value, null, 2));
            setMetadata(data.metadata == null ? '' : JSON.stringify(data.metadata, null, 2));
            setExpiration(toLocalDateTime(key.expiration));
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('kvManager.loadValueError')));
        }
    };

    const resetEditor = () => {
        setSelectedKey(null);
        setKeyName('');
        setValue('');
        setMetadata('');
        setExpiration('');
        setError('');
    };

    const saveKey = async () => {
        if (!keyName.trim()) return;
        let parsedValue: unknown = value;
        let parsedMetadata: unknown;
        try { parsedValue = JSON.parse(value); } catch { /* Store non-JSON input as text. */ }
        try {
            parsedMetadata = metadata.trim() ? JSON.parse(metadata) : undefined;
        } catch {
            setError(t('kvManager.invalidMetadata'));
            return;
        }

        setSaving(true);
        setError('');
        try {
            const response = await authenticatedFetch(`/api/resources/kv/${namespace.id}/values/${encodeURIComponent(keyName.trim())}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    value: parsedValue,
                    metadata: parsedMetadata,
                    expiration: expiration ? Math.floor(new Date(expiration).getTime() / 1000) : undefined
                })
            });
            if (!response.ok) throw new Error((await response.json()).error || t('kvManager.saveError'));
            await loadPage(currentCursor, activePrefix);
            notify(t('kvManager.saveSuccess'), 'success');
            setSelectedKey(keyName.trim());
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('kvManager.saveError')));
        } finally {
            setSaving(false);
        }
    };

    const deleteKey = async (key: string) => {
        const accepted = await confirm({
            title: t('common.confirmDelete'),
            message: t('kvManager.confirmDeleteKey', { key }),
            confirmLabel: t('common.delete'),
            destructive: true
        });
        if (!accepted) return;
        try {
            const response = await authenticatedFetch(`/api/resources/kv/${namespace.id}/values/${encodeURIComponent(key)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error((await response.json()).error || t('kvManager.deleteError'));
            if (selectedKey === key) resetEditor();
            await loadPage(currentCursor, activePrefix);
            notify(t('kvManager.deleteSuccess'), 'success');
        } catch (requestError) {
            setError(getErrorMessage(requestError, t('kvManager.deleteError')));
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
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--kv-theme-light)] text-[var(--kv-theme)]"><Braces size={18} /></span>
                        <div className="min-w-0"><h2 className="text-base font-semibold text-[var(--text-main)]">{t('kvManager.title')}</h2><p className="truncate font-mono text-xs text-[var(--text-muted)]">{namespace.name}</p></div>
                    </div>
                    <button type="button" onClick={onClose} className="icon-button" title={t('common.close')}><X size={17} /></button>
                </header>

                {error && <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400" role="alert">{error}</div>}

                <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(260px,38%)_minmax(0,1fr)]">
                    <section className="flex min-h-64 flex-col border-b border-[var(--border-color)] md:border-b-0 md:border-r">
                        <div className="flex min-h-12 items-center gap-2 border-b border-[var(--border-color)] px-3">
                            <div className="relative min-w-0 flex-1">
                                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input value={prefix} onChange={event => setPrefix(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') search(); }} placeholder={t('kvManager.searchPrefix')} className="neo-input h-8 w-full pl-8 text-xs" />
                            </div>
                            <button type="button" onClick={search} className="icon-button" title={t('common.confirm')}><Search size={14} /></button>
                            <button type="button" onClick={() => void loadPage(currentCursor, activePrefix)} className="icon-button" title={t('common.refresh')}><RefreshCw size={14} /></button>
                            <button type="button" onClick={resetEditor} className="icon-button" title={t('kvManager.addKey')}><Plus size={14} /></button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto">
                            {loading ? <Loader2 size={20} className="mx-auto mt-16 animate-spin text-[var(--text-muted)]" /> : keys.length === 0 ? (
                                <p className="px-4 py-16 text-center text-xs text-[var(--text-muted)]">{t('kvManager.noKeys')}</p>
                            ) : keys.map(key => (
                                <div key={key.name} className={`flex items-center border-b border-[var(--border-color)] px-2 py-1 ${selectedKey === key.name ? 'bg-[var(--bg-hover)]' : ''}`}>
                                    <button type="button" onClick={() => void selectKey(key)} className="min-w-0 flex-1 px-1 py-2 text-left">
                                        <div className="truncate font-mono text-xs text-[var(--text-main)]">{key.name}</div>
                                        <div className="text-[10px] text-[var(--text-muted)]">{key.expiration ? new Date(key.expiration * 1000).toLocaleString() : t('kvManager.noExpiration')}</div>
                                    </button>
                                    <button type="button" onClick={() => void deleteKey(key.name)} className="icon-button danger" title={t('common.delete')}><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                        <footer className="flex min-h-11 items-center justify-between border-t border-[var(--border-color)] px-3 text-xs text-[var(--text-muted)]">
                            <span>{t('kvManager.resultCount', { count: keys.length })}</span>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={previousPage} disabled={history.length === 0} className="icon-button" title={t('resourceList.previous')}><ChevronLeft size={14} /></button>
                                <button type="button" onClick={nextPage} disabled={!nextCursor} className="icon-button" title={t('resourceList.next')}><ChevronRight size={14} /></button>
                            </div>
                        </footer>
                    </section>

                    <section className="flex min-h-0 flex-col">
                        <div className="flex min-h-12 items-center border-b border-[var(--border-color)] px-4 text-xs font-semibold text-[var(--text-main)]">
                            {selectedKey ? t('kvManager.editKey') : t('kvManager.addKeyPair')}
                        </div>
                        <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(140px,1fr)] gap-3 overflow-auto p-4">
                            <label className="text-xs text-[var(--text-muted)]">
                                <span className="mb-1 block">{t('kvManager.keyName')}</span>
                                <input value={keyName} onChange={event => setKeyName(event.target.value)} disabled={selectedKey !== null} className="neo-input h-9 w-full font-mono text-sm disabled:opacity-70" />
                            </label>
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                <label className="text-xs text-[var(--text-muted)]"><span className="mb-1 block">{t('kvManager.expiration')}</span><input type="datetime-local" value={expiration} onChange={event => setExpiration(event.target.value)} className="neo-input h-9 w-full text-sm" /></label>
                                <label className="text-xs text-[var(--text-muted)]"><span className="mb-1 block">{t('kvManager.metadata')}</span><input value={metadata} onChange={event => setMetadata(event.target.value)} placeholder="{}" className="neo-input h-9 w-full font-mono text-sm" /></label>
                            </div>
                            <label className="flex min-h-0 flex-col text-xs text-[var(--text-muted)]"><span className="mb-1 block">{t('kvManager.value')}</span><textarea value={value} onChange={event => setValue(event.target.value)} placeholder={t('kvManager.valuePlaceholder')} spellCheck={false} className="min-h-40 flex-1 resize-none rounded-sm border border-[var(--border-color)] bg-[var(--bg-input)] p-3 font-mono text-sm text-[var(--text-main)] outline-none focus:border-[var(--kv-theme)]" /></label>
                        </div>
                        <footer className="flex min-h-14 items-center justify-end gap-2 border-t border-[var(--border-color)] px-4">
                            <button type="button" onClick={resetEditor} className="console-button secondary">{t('common.cancel')}</button>
                            <button type="button" onClick={saveKey} disabled={saving || !keyName.trim()} className="console-button primary">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? t('common.saving') : t('common.save')}
                            </button>
                        </footer>
                    </section>
                </main>
            </div>
        </div>,
        document.body
    );
}
