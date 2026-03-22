import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { authenticatedFetch } from '../../api';

interface KVManagerProps {
    namespace: { id: string; name: string };
    onClose: () => void;
}

const KVManager: React.FC<KVManagerProps> = ({ namespace, onClose }) => {
    const { t } = useTranslation();
    const [keys, setKeys] = useState<Array<{ name: string }>>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [value, setValue] = useState<string>('');
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Confirmation Modal State
    const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

    // 加载键列表
    const loadKeys = async () => {
        try {
            const res = await authenticatedFetch(`/api/resources/kv/${namespace.id}/keys`);
            const data = await res.json();
            setKeys(data.keys || []);
        } catch (err) {
            setError(t('kvManager.loadKeysError'));
        }
    };

    // 获取键值
    const loadValue = async (key: string) => {
        try {
            const res = await authenticatedFetch(`/api/resources/kv/${namespace.id}/values/${encodeURIComponent(key)}`);
            if (res.ok) {
                const data = await res.json();
                setValue(typeof data.value === 'string' ? data.value : JSON.stringify(data.value, null, 2));
                setSelectedKey(key);
            }
        } catch (err) {
            setError(t('kvManager.loadValueError'));
        }
    };

    // 保存键值对
    const saveKeyValue = async () => {
        if (!newKey) return;
        setLoading(true);
        setError('');

        try {
            let parsedValue = newValue;
            try {
                parsedValue = JSON.parse(newValue);
            } catch {
                // 保持字符串格式
            }

            const res = await authenticatedFetch(`/api/resources/kv/${namespace.id}/values/${encodeURIComponent(newKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: parsedValue })
            });

            if (res.ok) {
                setNewKey('');
                setNewValue('');
                await loadKeys();
            } else {
                setError(t('kvManager.saveError'));
            }
        } catch (err) {
            setError(t('kvManager.saveError') + ': ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // 删除键 - 请求确认
    const requestDelete = (key: string) => {
        setKeyToDelete(key);
    };

    // 执行删除
    const executeDelete = async () => {
        if (!keyToDelete) return;

        try {
            const res = await authenticatedFetch(`/api/resources/kv/${namespace.id}/values/${encodeURIComponent(keyToDelete)}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await loadKeys();
                if (selectedKey === keyToDelete) {
                    setSelectedKey(null);
                    setValue('');
                }
            }
        } catch (err) {
            setError(t('kvManager.deleteError'));
        } finally {
            setKeyToDelete(null);
        }
    };

    useEffect(() => {
        loadKeys();
    }, [namespace.id]);

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header - Purple Theme */}
                <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-card)]/50">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-[var(--kv-theme-light)] text-[var(--kv-theme)] flex items-center justify-center text-xl">
                            🗄️
                        </span>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)]">{t('kvManager.title')}</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">{t('kvManager.namespaceLabel')} <span className="text-[var(--kv-theme)] font-mono">{namespace.name}</span></p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 mx-6 mt-4 rounded-lg text-sm flex items-center gap-2">
                        ⚠️ {error}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6">
                    <div className="grid grid-cols-2 gap-6 h-full" style={{ height: 'calc(90vh - 180px)' }}>
                        {/* 左侧：键列表 */}
                        <div className="flex flex-col h-full">
                            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span>📝</span> {t('kvManager.keysList')} ({keys.length})
                            </h3>
                            <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg p-3">
                                {keys.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                                        <span className="text-3xl mb-2 opacity-30">📝</span>
                                        <p>{t('kvManager.noKeys')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {keys.map(key => (
                                            <div
                                                key={key.name}
                                                className={`p-2.5 rounded-lg flex justify-between items-center transition-all ${
                                                    selectedKey === key.name 
                                                        ? 'bg-[var(--kv-theme)] text-white shadow-md' 
                                                        : 'bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-main)] border border-[var(--border-color)]'
                                                }`}
                                            >
                                                <button
                                                    onClick={() => loadValue(key.name)}
                                                    className="flex-1 text-left truncate font-mono text-sm"
                                                >
                                                    {key.name}
                                                </button>
                                                <button
                                                    onClick={() => requestDelete(key.name)}
                                                    className={`ml-2 p-1.5 rounded-md transition-colors ${
                                                        selectedKey === key.name 
                                                            ? 'hover:bg-white/20 text-white/80' 
                                                            : 'text-red-400 hover:bg-red-900/20 hover:text-red-500'
                                                    }`}
                                                    title={t('common.delete')}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 右侧：值编辑 */}
                        <div className="flex flex-col h-full">
                            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span>✏️</span> {selectedKey ? t('kvManager.viewing') + ' ' + selectedKey : t('kvManager.addKeyPair')}
                            </h3>

                            {/* 键输入 */}
                            <div className="mb-3">
                                <label className="text-xs text-[var(--text-muted)] mb-1.5 block">{t('kvManager.keyName')}</label>
                                <input
                                    type="text"
                                    placeholder={t('kvManager.keyName')}
                                    value={newKey}
                                    onChange={e => setNewKey(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-[var(--bg-input)] text-[var(--text-main)] rounded-lg border border-[var(--border-color)] focus:border-[var(--kv-theme)] focus:ring-2 focus:ring-[var(--kv-theme-light)] focus:outline-none transition-all font-mono text-sm"
                                />
                            </div>

                            {/* 值输入 */}
                            <div className="flex-1 mb-3">
                                <label className="text-xs text-[var(--text-muted)] mb-1.5 block">{t('kvManager.valuePlaceholder')}</label>
                                <textarea
                                    placeholder={t('kvManager.valuePlaceholder')}
                                    value={selectedKey ? value : newValue}
                                    onChange={e => selectedKey ? setValue(e.target.value) : setNewValue(e.target.value)}
                                    className="w-full h-full min-h-[120px] px-3 py-2.5 bg-[var(--bg-input)] text-[var(--text-main)] rounded-lg border border-[var(--border-color)] focus:border-[var(--kv-theme)] focus:ring-2 focus:ring-[var(--kv-theme-light)] focus:outline-none transition-all font-mono text-sm resize-none"
                                />
                            </div>

                            {/* 保存按钮 */}
                            <button
                                onClick={saveKeyValue}
                                disabled={!newKey || loading}
                                className="px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: !newKey || loading ? 'var(--bg-hover)' : 'var(--kv-theme)',
                                    color: 'white'
                                }}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        {t('common.saving')}
                                    </>
                                ) : (
                                    <>
                                        <span>💾</span> {t('common.save')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {keyToDelete && (
                    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[110]">
                        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">{t('common.confirmDelete')}</h3>
                            <p className="text-[var(--text-muted)] mb-6">
                                {t('kvManager.confirmDeleteKey', { key: keyToDelete })}
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setKeyToDelete(null)}
                                    className="px-4 py-2 rounded-lg font-medium transition-colors"
                                    style={{
                                        backgroundColor: 'var(--bg-hover)',
                                        color: 'var(--text-muted)'
                                    }}
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={executeDelete}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
                                >
                                    {t('common.confirmDelete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default KVManager;