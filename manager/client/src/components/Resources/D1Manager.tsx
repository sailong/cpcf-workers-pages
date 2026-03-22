import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { authenticatedFetch } from '../../api';

interface D1ManagerProps {
    dbId: string;
    dbName: string;
    onClose: () => void;
}

interface Table {
    name: string;
}

interface QueryResult {
    columns: string[];
    rows: any[][];
}

export function D1Manager({ dbId, dbName, onClose }: D1ManagerProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'console' | 'tables'>('console');
    const [sqlInput, setSqlInput] = useState('');
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Tables
    const [tables, setTables] = useState<Table[]>([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [tableData, setTableData] = useState<QueryResult | null>(null);

    // Structure Viewer State
    const [structureData, setStructureData] = useState<any[]>([]);
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [structureTable, setStructureTable] = useState('');

    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        try {
            const res = await authenticatedFetch(`/api/resources/d1/${dbId}/tables`);
            const data = await res.json();
            setTables(data);
        } catch (e) {
            console.error(t('d1Manager.fetchTablesError'));
        }
    };

    const executeSQL = async () => {
        if (!sqlInput.trim()) return;

        setLoading(true);
        setError('');
        setQueryResult(null);

        try {
            const res = await authenticatedFetch(`/api/resources/d1/${dbId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: sqlInput })
            });

            const data = await res.json();

            if (res.ok) {
                setQueryResult(data);
                // 如果是 CREATE TABLE 等操作，刷新表列表
                if (sqlInput.toLowerCase().includes('create table') || sqlInput.toLowerCase().includes('drop table')) {
                    fetchTables();
                }
            } else {
                setError(data.error || t('d1Manager.queryError'));
            }
        } catch (e) {
            setError(t('d1Manager.requestError'));
        } finally {
            setLoading(false);
        }
    };

    const viewStructure = async (tableName: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row selection
        setStructureTable(tableName);
        setShowStructureModal(true);
        setStructureData([]);

        try {
            const res = await authenticatedFetch(`/api/resources/d1/${dbId}/schema/${tableName}`);
            const data = await res.json();
            if (res.ok) {
                setStructureData(data);
            }
        } catch (e) {
            console.error(t('d1Manager.fetchStructureError'));
        }
    };

    const loadTableData = async (tableName: string) => {
        setSelectedTable(tableName);
        setLoading(true);
        setError('');
        setTableData(null);

        try {
            const res = await authenticatedFetch(`/api/resources/d1/${dbId}/query?table=${encodeURIComponent(tableName)}`);
            const data = await res.json();

            if (res.ok) {
                setTableData(data);
            } else {
                setError(data.error || t('d1Manager.queryError'));
            }
        } catch (e) {
            setError(t('d1Manager.requestError'));
        } finally {
            setLoading(false);
        }
    };

    const quickSQL = (sql: string) => {
        setSqlInput(sql);
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-main)]">{t('d1Manager.title')}</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{t('d1Manager.database')} <span className="text-purple-400 font-mono">{dbName}</span></p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl">×</button>
                </div>

                {/* Tabs */}
                <div className="flex bg-[var(--bg-card)]/50 border-b border-[var(--border-color)]">
                    <button
                        onClick={() => setActiveTab('console')}
                        className={`px-6 py-3 font-medium text-sm transition-all ${activeTab === 'console'
                            ? 'bg-[var(--bg-base)] text-purple-500 border-b-2 border-purple-500'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                    >
                        {t('d1Manager.consoleTab')}
                    </button>
                    <button
                        onClick={() => setActiveTab('tables')}
                        className={`px-6 py-3 font-medium text-sm transition-all ${activeTab === 'tables'
                            ? 'bg-[var(--bg-base)] text-purple-500 border-b-2 border-purple-500'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                    >
                        {t('d1Manager.tablesTab')} ({tables.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'console' && (
                        <div className="space-y-4">
                            {/* Quick Actions */}
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => quickSQL('CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT,\n  email TEXT\n);')} className="text-xs bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-purple-500 text-[var(--text-muted)] px-3 py-1.5 rounded transition-colors">
                                    {t('d1Manager.createTableExample')}
                                </button>
                                <button onClick={() => quickSQL('SELECT * FROM ')} className="text-xs bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-purple-500 text-[var(--text-muted)] px-3 py-1.5 rounded transition-colors">
                                    {t('d1Manager.selectQuery')}
                                </button>
                                <button onClick={() => quickSQL('INSERT INTO ')} className="text-xs bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-purple-500 text-[var(--text-muted)] px-3 py-1.5 rounded transition-colors">
                                    {t('d1Manager.insertInsert')}
                                </button>
                            </div>

                            {/* SQL Input */}
                            <textarea
                                value={sqlInput}
                                onChange={e => setSqlInput(e.target.value)}
                                placeholder={t('d1Manager.sqlPlaceholder')}
                                className="w-full bg-[var(--bg-input)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-4 font-mono text-sm h-40 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none placeholder-[var(--text-muted)]"
                            />

                            <button
                                onClick={executeSQL}
                                disabled={loading || !sqlInput.trim()}
                                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 px-6 py-2 rounded-lg font-medium transition-all"
                            >
                                {loading ? t('d1Manager.executing') : t('d1Manager.execute')}
                            </button>

                            {/* Error */}
                            {error && (
                                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-red-300 text-sm">
                                    <strong>{t('d1Manager.error')}</strong> {error}
                                </div>
                            )}

                            {/* Query Result */}
                            {queryResult && (
                                <div className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg overflow-hidden">
                                    <div className="bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-muted)] border-b border-[var(--border-color)]">
                                        {t('d1Manager.queryResult')} {queryResult.rows ? `(${queryResult.rows.length} ${t('d1Manager.rows')})` : ''}
                                    </div>
                                    {queryResult.rows && queryResult.rows.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-[var(--bg-card)]">
                                                    <tr>
                                                        {queryResult.columns.map((col, i) => (
                                                            <th key={i} className="px-4 py-2 text-left text-[var(--text-muted)] font-medium">
                                                                {col}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {queryResult.rows.map((row, i) => (
                                                        <tr key={i} className="border-t border-gray-800 hover:bg-gray-900/50">
                                                            {row.map((cell, j) => (
                                                                <td key={j} className="px-4 py-2 text-gray-300 font-mono">
                                                                    {cell === null ? <span className="text-gray-600 italic">NULL</span> : String(cell)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-gray-600 text-sm">
                                            {queryResult.rows ? t('d1Manager.noData') : t('d1Manager.success')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tables' && (
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Tables List */}
                            <div className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg p-4">
                                <h3 className="font-semibold mb-3 text-sm text-[var(--text-muted)]">{t('d1Manager.tableList')}</h3>
                                {tables.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600 text-sm">
                                        {t('d1Manager.noTables')}<br />
                                        <span className="text-xs">{t('d1Manager.createTableHint')}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {tables.map(table => (
                                            <div key={table.name} className="flex gap-1 mb-1">
                                                <button
                                                    onClick={() => loadTableData(table.name)}
                                                    className={`flex-1 text-left px-3 py-2 rounded text-sm transition-all truncate ${selectedTable === table.name
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card)]/80 text-[var(--text-muted)]'
                                                        }`}
                                                >
                                                    📋 {table.name}
                                                </button>
                                                <button
                                                    onClick={(e) => viewStructure(table.name, e)}
                                                    className="px-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-purple-300 rounded"
                                                    title={t('d1Manager.viewStructure')}
                                                >
                                                    ℹ️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Table Data */}
                            <div className="md:col-span-2 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg overflow-hidden">
                                {!selectedTable ? (
                                    <div className="p-8 text-center text-gray-600 text-sm">
                                        {t('d1Manager.selectToView')}
                                    </div>
                                ) : loading ? (
                                    <div className="p-8 text-center text-gray-500">{t('d1Manager.loading')}</div>
                                ) : error ? (
                                    <div className="p-4 bg-red-900/20 border border-red-700/50 text-red-300 text-sm">
                                        {error}
                                    </div>
                                ) : tableData && tableData.rows && tableData.rows.length > 0 ? (
                                    <>
                                        <div className="bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-muted)]">
                                            {selectedTable} ({tableData.rows.length} {t('d1Manager.rows')})
                                        </div>
                                        <div className="overflow-x-auto max-h-96">
                                            <table className="w-full text-sm">
                                                <thead className="bg-[var(--bg-card)] sticky top-0">
                                                    <tr>
                                                        {tableData.columns.map((col, i) => (
                                                            <th key={i} className="px-4 py-2 text-left text-[var(--text-muted)] font-medium">
                                                                {col}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tableData.rows.map((row, i) => (
                                                        <tr key={i} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-card)]/50">
                                                            {row.map((cell, j) => (
                                                                <td key={j} className="px-4 py-2 text-[var(--text-main)] font-mono">
                                                                    {cell === null ? <span className="text-gray-600 italic">NULL</span> : String(cell)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-8 text-center text-gray-600 text-sm">{t('d1Manager.tableEmpty')}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Structure Modal */}
            {showStructureModal && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-8">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-card)]">
                            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                                <span className="text-purple-400">ℹ️</span>
                                {t('d1Manager.structureTitle')} {structureTable}
                            </h3>
                            <button onClick={() => setShowStructureModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">✕</button>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-[var(--text-muted)] uppercase bg-[var(--bg-base)] sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">{t('d1Manager.cid')}</th>
                                        <th className="px-6 py-3">{t('d1Manager.name')}</th>
                                        <th className="px-6 py-3">{t('d1Manager.type')}</th>
                                        <th className="px-6 py-3">{t('d1Manager.notNull')}</th>
                                        <th className="px-6 py-3">{t('d1Manager.default')}</th>
                                        <th className="px-6 py-3">{t('d1Manager.pk')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {structureData.map((col: any) => (
                                        <tr key={col.cid} className="bg-[var(--bg-card)] hover:bg-[var(--bg-base)]">
                                            <td className="px-6 py-3 text-[var(--text-muted)] font-mono">{col.cid}</td>
                                            <td className="px-6 py-3 font-bold text-[var(--text-main)] font-mono">{col.name}</td>
                                            <td className="px-6 py-3 text-yellow-500 font-mono">{col.type}</td>
                                            <td className="px-6 py-3 text-[var(--text-muted)]">{col.notnull ? '✅' : '❌'}</td>
                                            <td className="px-6 py-3 text-[var(--text-muted)] font-mono">{col.dflt_value === null ? 'NULL' : col.dflt_value}</td>
                                            <td className="px-6 py-3 text-[var(--text-muted)]">{col.pk ? '🔑' : ''}</td>
                                        </tr>
                                    ))}
                                    {structureData.length === 0 && (
                                        <tr><td colSpan={6} className="px-6 py-8 text-center text-[var(--text-muted)]">{t('d1Manager.loading')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-card)] text-right">
                            <button onClick={() => setShowStructureModal(false)} className="px-4 py-2 bg-[var(--bg-base)] hover:bg-[var(--bg-base)]/80 text-[var(--text-main)] border border-[var(--border-color)] rounded">{t('d1Manager.close')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}

export default D1Manager;
