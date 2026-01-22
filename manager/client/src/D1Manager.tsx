import { useState, useEffect } from 'react';

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
    const [activeTab, setActiveTab] = useState<'console' | 'tables'>('console');
    const [sqlInput, setSqlInput] = useState('');
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Tables
    const [tables, setTables] = useState<Table[]>([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [tableData, setTableData] = useState<QueryResult | null>(null);

    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        try {
            const res = await fetch(`/api/resources/d1/${dbId}/tables`);
            const data = await res.json();
            setTables(data);
        } catch (e) {
            console.error('Failed to fetch tables');
        }
    };

    const executeSQL = async () => {
        if (!sqlInput.trim()) return;

        setLoading(true);
        setError('');
        setQueryResult(null);

        try {
            const res = await fetch(`/api/resources/d1/${dbId}/execute`, {
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
                setError(data.error || 'SQL 执行失败');
            }
        } catch (e) {
            setError('请求失败');
        } finally {
            setLoading(false);
        }
    };

    const loadTableData = async (tableName: string) => {
        setSelectedTable(tableName);
        setLoading(true);
        setError('');
        setTableData(null);

        try {
            const res = await fetch(`/api/resources/d1/${dbId}/query?table=${encodeURIComponent(tableName)}`);
            const data = await res.json();

            if (res.ok) {
                setTableData(data);
            } else {
                setError(data.error || '查询失败');
            }
        } catch (e) {
            setError('请求失败');
        } finally {
            setLoading(false);
        }
    };

    const quickSQL = (sql: string) => {
        setSqlInput(sql);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-100">D1 Database Manager</h2>
                        <p className="text-sm text-gray-500 mt-1">数据库: <span className="text-purple-400 font-mono">{dbName}</span></p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-800/50 border-b border-gray-800">
                    <button
                        onClick={() => setActiveTab('console')}
                        className={`px-6 py-3 font-medium text-sm transition-all ${activeTab === 'console'
                                ? 'bg-gray-900 text-purple-400 border-b-2 border-purple-400'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        SQL 控制台
                    </button>
                    <button
                        onClick={() => setActiveTab('tables')}
                        className={`px-6 py-3 font-medium text-sm transition-all ${activeTab === 'tables'
                                ? 'bg-gray-900 text-purple-400 border-b-2 border-purple-400'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        表浏览器 ({tables.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'console' && (
                        <div className="space-y-4">
                            {/* Quick Actions */}
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => quickSQL('CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT,\n  email TEXT\n);')} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded">
                                    CREATE TABLE 示例
                                </button>
                                <button onClick={() => quickSQL('SELECT * FROM ')} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded">
                                    SELECT 查询
                                </button>
                                <button onClick={() => quickSQL('INSERT INTO ')} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded">
                                    INSERT 插入
                                </button>
                            </div>

                            {/* SQL Input */}
                            <textarea
                                value={sqlInput}
                                onChange={e => setSqlInput(e.target.value)}
                                placeholder="输入 SQL 语句... (例如: SELECT * FROM users)"
                                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-4 font-mono text-sm h-40 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            />

                            <button
                                onClick={executeSQL}
                                disabled={loading || !sqlInput.trim()}
                                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 px-6 py-2 rounded-lg font-medium transition-all"
                            >
                                {loading ? '执行中...' : '执行 SQL'}
                            </button>

                            {/* Error */}
                            {error && (
                                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-red-300 text-sm">
                                    <strong>错误:</strong> {error}
                                </div>
                            )}

                            {/* Query Result */}
                            {queryResult && (
                                <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                                    <div className="bg-gray-800 px-4 py-2 text-sm text-gray-400">
                                        查询结果 {queryResult.rows ? `(${queryResult.rows.length} 行)` : ''}
                                    </div>
                                    {queryResult.rows && queryResult.rows.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-800/50">
                                                    <tr>
                                                        {queryResult.columns.map((col, i) => (
                                                            <th key={i} className="px-4 py-2 text-left text-gray-400 font-medium">
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
                                            {queryResult.rows ? '无数据' : 'SQL 执行成功'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tables' && (
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Tables List */}
                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                <h3 className="font-semibold mb-3 text-sm text-gray-400">数据表列表</h3>
                                {tables.length === 0 ? (
                                    <div className="text-center py-8 text-gray-600 text-sm">
                                        暂无数据表<br />
                                        <span className="text-xs">在 SQL 控制台创建表</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {tables.map(table => (
                                            <button
                                                key={table.name}
                                                onClick={() => loadTableData(table.name)}
                                                className={`w-full text-left px-3 py-2 rounded text-sm transition-all ${selectedTable === table.name
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                                    }`}
                                            >
                                                📋 {table.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Table Data */}
                            <div className="md:col-span-2 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                                {!selectedTable ? (
                                    <div className="p-8 text-center text-gray-600 text-sm">
                                        ← 选择一个表查看数据
                                    </div>
                                ) : loading ? (
                                    <div className="p-8 text-center text-gray-500">加载中...</div>
                                ) : error ? (
                                    <div className="p-4 bg-red-900/20 border border-red-700/50 text-red-300 text-sm">
                                        {error}
                                    </div>
                                ) : tableData && tableData.rows && tableData.rows.length > 0 ? (
                                    <>
                                        <div className="bg-gray-800 px-4 py-2 text-sm text-gray-400">
                                            {selectedTable} ({tableData.rows.length} 行)
                                        </div>
                                        <div className="overflow-x-auto max-h-96">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-800/50 sticky top-0">
                                                    <tr>
                                                        {tableData.columns.map((col, i) => (
                                                            <th key={i} className="px-4 py-2 text-left text-gray-400 font-medium">
                                                                {col}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tableData.rows.map((row, i) => (
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
                                    </>
                                ) : (
                                    <div className="p-8 text-center text-gray-600 text-sm">表为空</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
