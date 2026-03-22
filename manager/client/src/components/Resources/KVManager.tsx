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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden relative border border-gray-700">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">{t('kvManager.title')}</h2>
                        <p className="text-purple-200 text-sm">{t('kvManager.namespaceLabel')} {namespace.name}</p>
                    </div>
                    <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">&times;</button>
                </div>

                {error && (
                    <div className="bg-red-500 text-white px-4 py-2 m-4 rounded">{error}</div>
                )}

                <div className="grid grid-cols-2 gap-4 p-6" style={{ height: 'calc(90vh - 150px)' }}>
                    {/* 左侧：键列表 */}
                    <div className="flex flex-col h-full">
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">{t('kvManager.keysList')} ({keys.length})</h3>
                        <div className="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-3">
                            {keys.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">{t('kvManager.noKeys')}</p>
                            ) : (
                                keys.map(key => (
                                    <div
                                        key={key.name}
                                        className={`p-2 mb-2 rounded flex justify-between items-center ${selectedKey === key.name ? 'bg-purple-700' : 'bg-gray-800 hover:bg-gray-700'
                                            }`}
                                    >
                                        <button
                                            onClick={() => loadValue(key.name)}
                                            className="flex-1 text-left text-gray-200 truncate"
                                        >
                                            {key.name}
                                        </button>
                                        <button
                                            onClick={() => requestDelete(key.name)}
                                            className="ml-2 text-red-400 hover:text-red-300"
                                            title={t('common.delete')}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 右侧：值编辑 */}
                    <div className="flex flex-col h-full">
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">
                            {selectedKey ? `${t('kvManager.viewing')} ${selectedKey}` : t('kvManager.addKeyPair')}
                        </h3>

                        {/* 键输入 */}
                        <input
                            type="text"
                            placeholder={t('kvManager.keyName')}
                            value={newKey}
                            onChange={e => setNewKey(e.target.value)}
                            className="mb-2 px-3 py-2 bg-gray-900 text-gray-200 rounded border border-gray-700 focus:border-purple-500 focus:outline-none"
                        />

                        {/* 值输入 */}
                        <textarea
                            placeholder={t('kvManager.valuePlaceholder')}
                            value={selectedKey ? value : newValue}
                            onChange={e => selectedKey ? setValue(e.target.value) : setNewValue(e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-900 text-gray-200 rounded border border-gray-700 focus:border-purple-500 focus:outline-none font-mono text-sm mb-3"
                        />

                        <button
                            onClick={saveKeyValue}
                            disabled={!newKey || loading}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded font-semibold"
                        >
                            {loading ? t('common.saving') : t('common.save')}
                        </button>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {keyToDelete && (
                    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[60]">
                        <div className="bg-gray-800 border border-gray-600 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
                            <h3 className="text-xl font-bold text-white mb-4">{t('common.confirmDelete')}</h3>
                            <p className="text-gray-300 mb-6">
                                {t('kvManager.confirmDeleteKey', { key: keyToDelete })}
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setKeyToDelete(null)}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={executeDelete}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold"
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
