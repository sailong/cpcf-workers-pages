import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
    CheckCircle2,
    Code2,
    Database,
    FileUp,
    Info,
    Loader2,
    Play,
    RefreshCw,
    Table2,
    Upload,
    X,
} from 'lucide-react';
import { authenticatedFetch } from '../../api';
import { useFeedback } from '../../contexts/feedback-context';

interface D1ManagerProps {
    dbId: string;
    dbName: string;
    onClose: () => void;
}

interface Table {
    name: string;
}

interface QueryResult {
    columns?: string[];
    rows?: unknown[][];
    success?: boolean;
}

interface TableColumn {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
}

interface AppliedMigration {
    id: number;
    name: string;
    appliedAt: string;
}

interface MigrationFile {
    name: string;
    sql: string;
    size: number;
}

type ActiveTab = 'console' | 'tables' | 'migrations';
type TableView = 'data' | 'structure';

async function responseData(response: Response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

export function D1Manager({ dbId, dbName, onClose }: D1ManagerProps) {
    const { t } = useTranslation();
    const { confirm, notify } = useFeedback();
    const migrationInput = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('console');
    const [sqlInput, setSqlInput] = useState('');
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [tables, setTables] = useState<Table[]>([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [tableView, setTableView] = useState<TableView>('data');
    const [tableData, setTableData] = useState<QueryResult | null>(null);
    const [structureData, setStructureData] = useState<TableColumn[]>([]);

    const [appliedMigrations, setAppliedMigrations] = useState<AppliedMigration[]>([]);
    const [migrationFiles, setMigrationFiles] = useState<MigrationFile[]>([]);
    const [migrationLoading, setMigrationLoading] = useState(false);

    const fetchTables = useCallback(async () => {
        try {
            const response = await authenticatedFetch(`/api/resources/d1/${dbId}/tables`);
            setTables(await responseData(response));
        } catch {
            notify(t('d1Manager.fetchTablesError'), 'error');
        }
    }, [dbId, notify, t]);

    const fetchMigrations = useCallback(async () => {
        try {
            const response = await authenticatedFetch(`/api/resources/d1/${dbId}/migrations`);
            const data = await responseData(response);
            setAppliedMigrations(data.applied || []);
        } catch (requestError) {
            notify(requestError instanceof Error ? requestError.message : t('d1Manager.requestError'), 'error');
        }
    }, [dbId, notify, t]);

    useEffect(() => {
        void fetchTables();
        void fetchMigrations();
    }, [fetchMigrations, fetchTables]);

    const executeSQL = async () => {
        if (!sqlInput.trim()) return;
        setLoading(true);
        setError('');
        setQueryResult(null);
        try {
            const response = await authenticatedFetch(`/api/resources/d1/${dbId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: sqlInput })
            });
            setQueryResult(await responseData(response));
            if (/\b(create|drop|alter)\s+table\b/i.test(sqlInput)) await fetchTables();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : t('d1Manager.requestError'));
        } finally {
            setLoading(false);
        }
    };

    const loadTable = async (tableName: string, view: TableView = 'data') => {
        setSelectedTable(tableName);
        setTableView(view);
        setLoading(true);
        setError('');
        setTableData(null);
        setStructureData([]);
        try {
            const endpoint = view === 'data'
                ? `/api/resources/d1/${dbId}/query?table=${encodeURIComponent(tableName)}`
                : `/api/resources/d1/${dbId}/schema/${encodeURIComponent(tableName)}`;
            const response = await authenticatedFetch(endpoint);
            const data = await responseData(response);
            if (view === 'data') setTableData(data);
            else setStructureData(data);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : t('d1Manager.requestError'));
        } finally {
            setLoading(false);
        }
    };

    const selectMigrationFiles = async (files: FileList | null) => {
        if (!files) return;
        const selected = await Promise.all(Array.from(files)
            .filter(file => file.name.toLowerCase().endsWith('.sql'))
            .map(async file => ({
                name: file.webkitRelativePath || file.name,
                sql: await file.text(),
                size: file.size
            })));
        setMigrationFiles(selected);
        setError('');
    };

    const applyMigrations = async () => {
        if (migrationFiles.length === 0) return;
        const accepted = await confirm({
            title: t('d1Manager.applyMigrations'),
            message: t('d1Manager.applyConfirm', { count: migrationFiles.length }),
            confirmLabel: t('d1Manager.apply')
        });
        if (!accepted) return;

        setMigrationLoading(true);
        setError('');
        try {
            const response = await authenticatedFetch(`/api/resources/d1/${dbId}/migrations/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ migrations: migrationFiles.map(({ name, sql }) => ({ name, sql })) })
            });
            const data = await responseData(response);
            setAppliedMigrations(data.migrations || []);
            setMigrationFiles([]);
            if (migrationInput.current) migrationInput.current.value = '';
            await fetchTables();
            notify(t('d1Manager.applySuccess', { count: data.applied?.length || 0 }), 'success');
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : t('d1Manager.requestError');
            setError(message);
            notify(message, 'error');
        } finally {
            setMigrationLoading(false);
        }
    };

    const tabs: Array<{ id: ActiveTab; label: string; icon: typeof Code2 }> = [
        { id: 'console', label: t('d1Manager.consoleTab'), icon: Code2 },
        { id: 'tables', label: `${t('d1Manager.tablesTab')} (${tables.length})`, icon: Table2 },
        { id: 'migrations', label: `${t('d1Manager.migrationsTab')} (${appliedMigrations.length})`, icon: FileUp }
    ];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 sm:p-5">
            <div className="flex h-[min(900px,94vh)] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
                <header className="flex min-h-16 items-center justify-between border-b border-[var(--border-color)] px-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--d1-theme-light)] text-[var(--d1-theme)]">
                            <Database size={18} />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-semibold text-[var(--text-main)]">{t('d1Manager.title')}</h2>
                            <p className="truncate font-mono text-xs text-[var(--text-muted)]">{dbName}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="icon-button" title={t('d1Manager.close')}>
                        <X size={17} />
                    </button>
                </header>

                <nav className="flex min-h-11 overflow-x-auto border-b border-[var(--border-color)] px-2" aria-label={t('d1Manager.title')}>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => { setActiveTab(tab.id); setError(''); }}
                                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 text-xs font-medium ${activeTab === tab.id
                                    ? 'border-[var(--d1-theme)] text-[var(--d1-theme)]'
                                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                            >
                                <Icon size={15} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {error && (
                    <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400" role="alert">
                        {error}
                    </div>
                )}

                <main className="min-h-0 flex-1 overflow-auto">
                    {activeTab === 'console' && (
                        <div className="flex h-full min-h-[460px] flex-col">
                            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] px-4 py-2">
                                <button type="button" onClick={() => setSqlInput('SELECT * FROM ')} className="console-button secondary text-xs">SELECT</button>
                                <button type="button" onClick={() => setSqlInput('INSERT INTO ')} className="console-button secondary text-xs">INSERT</button>
                                <button type="button" onClick={() => setSqlInput('CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);')} className="console-button secondary text-xs">CREATE TABLE</button>
                                <button
                                    type="button"
                                    onClick={executeSQL}
                                    disabled={loading || !sqlInput.trim()}
                                    className="console-button primary ml-auto"
                                >
                                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                                    {loading ? t('d1Manager.executing') : t('d1Manager.execute')}
                                </button>
                            </div>
                            <textarea
                                value={sqlInput}
                                onChange={event => setSqlInput(event.target.value)}
                                placeholder={t('d1Manager.sqlPlaceholder')}
                                spellCheck={false}
                                className="min-h-44 w-full resize-y border-0 border-b border-[var(--border-color)] bg-[var(--bg-input)] p-4 font-mono text-sm text-[var(--text-main)] outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--d1-theme)]"
                            />
                            <div className="min-h-0 flex-1 overflow-auto">
                                <ResultTable result={queryResult} emptyLabel={t('d1Manager.noResult')} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'tables' && (
                        <div className="grid min-h-[520px] grid-cols-1 md:h-full md:grid-cols-[240px_minmax(0,1fr)]">
                            <aside className="border-b border-[var(--border-color)] md:border-b-0 md:border-r">
                                <div className="flex h-11 items-center justify-between border-b border-[var(--border-color)] px-3">
                                    <span className="text-xs font-semibold uppercase text-[var(--text-muted)]">{t('d1Manager.tableList')}</span>
                                    <button type="button" onClick={() => void fetchTables()} className="icon-button" title={t('common.refresh')}>
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                                <div className="max-h-52 overflow-auto p-2 md:max-h-[calc(100%-44px)]">
                                    {tables.length === 0 ? (
                                        <p className="px-2 py-8 text-center text-xs text-[var(--text-muted)]">{t('d1Manager.noTables')}</p>
                                    ) : tables.map(table => (
                                        <div key={table.name} className={`group flex items-center rounded-sm ${selectedTable === table.name ? 'bg-[var(--bg-hover)]' : ''}`}>
                                            <button type="button" onClick={() => void loadTable(table.name, 'data')} className="min-w-0 flex-1 truncate px-2 py-2 text-left font-mono text-xs text-[var(--text-main)]">
                                                {table.name}
                                            </button>
                                            <button type="button" onClick={() => void loadTable(table.name, 'structure')} className="icon-button mr-1" title={t('d1Manager.viewStructure')}>
                                                <Info size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </aside>
                            <section className="min-w-0">
                                <div className="flex h-11 items-center gap-1 border-b border-[var(--border-color)] px-3">
                                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text-main)]">{selectedTable || t('d1Manager.selectTable')}</span>
                                    {selectedTable && (
                                        <>
                                            <button type="button" onClick={() => void loadTable(selectedTable, 'data')} className={`console-segment-button ${tableView === 'data' ? 'console-segment-active' : ''}`}>{t('d1Manager.data')}</button>
                                            <button type="button" onClick={() => void loadTable(selectedTable, 'structure')} className={`console-segment-button ${tableView === 'structure' ? 'console-segment-active' : ''}`}>{t('d1Manager.structure')}</button>
                                        </>
                                    )}
                                </div>
                                <div className="max-h-[calc(94vh-184px)] overflow-auto">
                                    {loading ? (
                                        <div className="flex min-h-64 items-center justify-center text-[var(--text-muted)]"><Loader2 size={20} className="animate-spin" /></div>
                                    ) : tableView === 'structure' && selectedTable ? (
                                        <StructureTable columns={structureData} t={t} />
                                    ) : (
                                        <ResultTable result={tableData} emptyLabel={selectedTable ? t('d1Manager.tableEmpty') : t('d1Manager.selectToView')} />
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'migrations' && (
                        <div className="grid min-h-[520px] grid-cols-1 md:h-full md:grid-cols-2">
                            <section className="border-b border-[var(--border-color)] md:border-b-0 md:border-r">
                                <div className="flex min-h-12 items-center gap-2 border-b border-[var(--border-color)] px-3">
                                    <input ref={migrationInput} type="file" accept=".sql" multiple className="hidden" onChange={event => void selectMigrationFiles(event.target.files)} />
                                    <button type="button" onClick={() => migrationInput.current?.click()} className="console-button secondary">
                                        <Upload size={15} />
                                        {t('d1Manager.selectMigrations')}
                                    </button>
                                    <button type="button" onClick={applyMigrations} disabled={migrationLoading || migrationFiles.length === 0} className="console-button primary ml-auto">
                                        {migrationLoading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                                        {t('d1Manager.apply')}
                                    </button>
                                </div>
                                <MigrationTable files={migrationFiles} emptyLabel={t('d1Manager.noSelectedMigrations')} />
                            </section>
                            <section>
                                <div className="flex h-12 items-center justify-between border-b border-[var(--border-color)] px-3">
                                    <span className="text-xs font-semibold uppercase text-[var(--text-muted)]">{t('d1Manager.appliedMigrations')}</span>
                                    <button type="button" onClick={() => void fetchMigrations()} className="icon-button" title={t('common.refresh')}><RefreshCw size={14} /></button>
                                </div>
                                {appliedMigrations.length === 0 ? (
                                    <p className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">{t('d1Manager.noAppliedMigrations')}</p>
                                ) : (
                                    <table className="w-full table-fixed text-xs">
                                        <thead className="sticky top-0 bg-[var(--bg-base)] text-left text-[var(--text-muted)]">
                                            <tr><th className="w-12 px-3 py-2 font-medium">ID</th><th className="px-3 py-2 font-medium">{t('d1Manager.migration')}</th><th className="w-40 px-3 py-2 font-medium">{t('d1Manager.appliedAt')}</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-color)]">
                                            {appliedMigrations.map(migration => (
                                                <tr key={migration.id}>
                                                    <td className="px-3 py-2 text-[var(--text-muted)]">{migration.id}</td>
                                                    <td className="truncate px-3 py-2 font-mono text-[var(--text-main)]" title={migration.name}>{migration.name}</td>
                                                    <td className="px-3 py-2 text-[var(--text-muted)]">{new Date(migration.appliedAt).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </section>
                        </div>
                    )}
                </main>
            </div>
        </div>,
        document.body
    );
}

function ResultTable({ result, emptyLabel }: { result: QueryResult | null; emptyLabel: string }) {
    if (!result?.rows?.length) {
        return (
            <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                {result?.success ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Database size={20} />}
                <span>{result?.success ? 'OK' : emptyLabel}</span>
            </div>
        );
    }
    return (
        <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--bg-base)] text-left text-[var(--text-muted)]">
                <tr>{result.columns?.map(column => <th key={column} className="border-b border-[var(--border-color)] px-3 py-2 font-medium">{column}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
                {result.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-[var(--bg-hover)]">
                        {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-80 truncate px-3 py-2 font-mono text-[var(--text-main)]">{cell === null ? <span className="italic text-[var(--text-muted)]">NULL</span> : String(cell)}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function StructureTable({ columns, t }: { columns: TableColumn[]; t: ReturnType<typeof useTranslation>['t'] }) {
    return (
        <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--bg-base)] text-left text-[var(--text-muted)]">
                <tr>
                    <th className="px-3 py-2 font-medium">{t('d1Manager.name')}</th>
                    <th className="px-3 py-2 font-medium">{t('d1Manager.type')}</th>
                    <th className="px-3 py-2 font-medium">{t('d1Manager.notNull')}</th>
                    <th className="px-3 py-2 font-medium">{t('d1Manager.default')}</th>
                    <th className="px-3 py-2 font-medium">{t('d1Manager.pk')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
                {columns.map(column => (
                    <tr key={column.cid}>
                        <td className="px-3 py-2 font-mono font-medium text-[var(--text-main)]">{column.name}</td>
                        <td className="px-3 py-2 font-mono text-[var(--d1-theme)]">{column.type || '-'}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{column.notnull ? t('common.yes') : t('common.no')}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-muted)]">{column.dflt_value == null ? 'NULL' : String(column.dflt_value)}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{column.pk ? t('common.yes') : t('common.no')}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function MigrationTable({ files, emptyLabel }: { files: MigrationFile[]; emptyLabel: string }) {
    if (files.length === 0) return <p className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">{emptyLabel}</p>;
    return (
        <table className="w-full table-fixed text-xs">
            <thead className="bg-[var(--bg-base)] text-left text-[var(--text-muted)]"><tr><th className="px-3 py-2 font-medium">Migration</th><th className="w-24 px-3 py-2 text-right font-medium">Size</th></tr></thead>
            <tbody className="divide-y divide-[var(--border-color)]">
                {files.map(file => (
                    <tr key={file.name}>
                        <td className="truncate px-3 py-2 font-mono text-[var(--text-main)]" title={file.name}>{file.name}</td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">{new Intl.NumberFormat().format(file.size)} B</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default D1Manager;
