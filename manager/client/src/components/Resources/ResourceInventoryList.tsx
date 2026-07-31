import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { D1Database, KVNamespace, Project, R2Bucket } from '../../types';
import { ProjectService } from '../../services/projects';
import { useFeedback } from '../../contexts/feedback-context';
import { getErrorMessage } from '../../utils/errors';

type Resource = KVNamespace | D1Database | R2Bucket;
type ResourceKind = 'kv' | 'd1' | 'r2';

interface ResourceInventoryListProps<T extends Resource> {
    kind: ResourceKind;
    title: string;
    emptyLabel: string;
    namePlaceholder: string;
    icon: LucideIcon;
    loadResources: () => Promise<T[]>;
    createResource: (name: string) => Promise<unknown>;
    deleteResource: (id: string) => Promise<unknown>;
    onManage: (resource: T) => void;
}

interface BindingReference {
    projectId: string;
    projectName: string;
    varName: string;
}

const PAGE_SIZE = 10;

function getBindings(projects: Project[], kind: ResourceKind) {
    const byResource = new Map<string, BindingReference[]>();
    for (const project of projects) {
        for (const binding of project.bindings?.[kind] || []) {
            const references = byResource.get(binding.resourceId) || [];
            references.push({ projectId: project.id, projectName: project.name, varName: binding.varName });
            byResource.set(binding.resourceId, references);
        }
    }
    return byResource;
}

export function ResourceInventoryList<T extends Resource>({
    kind,
    title,
    emptyLabel,
    namePlaceholder,
    icon: Icon,
    loadResources,
    createResource,
    deleteResource,
    onManage
}: ResourceInventoryListProps<T>) {
    const { t } = useTranslation();
    const { confirm, notify } = useFeedback();
    const [resources, setResources] = useState<T[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [resourceData, projectData] = await Promise.all([loadResources(), ProjectService.getAll()]);
            setResources(resourceData);
            setProjects(projectData);
        } catch (error) {
            notify(getErrorMessage(error, t('resourceList.loadError')), 'error');
        } finally {
            setLoading(false);
        }
    }, [loadResources, notify, t]);

    useEffect(() => { void load(); }, [load]);

    const bindings = useMemo(() => getBindings(projects, kind), [kind, projects]);
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = useMemo(() => resources.filter(resource => {
        if (!normalizedQuery) return true;
        const references = bindings.get(resource.id) || [];
        return resource.name.toLowerCase().includes(normalizedQuery)
            || resource.id.toLowerCase().includes(normalizedQuery)
            || references.some(reference => `${reference.projectName} ${reference.varName}`.toLowerCase().includes(normalizedQuery));
    }), [bindings, normalizedQuery, resources]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const boundCount = resources.filter(resource => (bindings.get(resource.id)?.length || 0) > 0).length;
    const bindingCount = [...bindings.values()].reduce((total, references) => total + references.length, 0);

    useEffect(() => { setPage(1); }, [normalizedQuery]);
    useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) return;
        try {
            await createResource(name);
            setNewName('');
            await load();
            notify(t('resourceList.createSuccess'), 'success');
        } catch (error) {
            notify(getErrorMessage(error, t('resourceList.createError')), 'error');
        }
    };

    const handleDelete = async (resource: T) => {
        const references = bindings.get(resource.id) || [];
        const accepted = await confirm({
            title: t('common.confirmDelete'),
            message: references.length > 0
                ? t('resourceList.confirmDeleteBound', { count: references.length })
                : t('resourceList.confirmDelete'),
            confirmLabel: t('common.delete'),
            destructive: true
        });
        if (!accepted) return;
        try {
            await deleteResource(resource.id);
            await load();
            notify(t('resourceList.movedToTrash'), 'success');
        } catch (error) {
            notify(getErrorMessage(error, t('resourceList.deleteError')), 'error');
        }
    };

    return (
        <div className="console-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--border-color)] p-3 lg:flex-row lg:items-center">
                <div className="flex min-w-48 items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                    <Icon size={17} /> {title}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
                        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('resourceList.search')} className="neo-input h-9 w-full pl-8 text-sm" />
                    </div>
                    <input
                        value={newName}
                        onChange={event => setNewName(event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') void handleCreate(); }}
                        placeholder={namePlaceholder}
                        className="neo-input h-9 min-w-0 flex-1 text-sm sm:w-44 sm:flex-none"
                    />
                    <button type="button" onClick={handleCreate} disabled={!newName.trim()} className="console-primary-button h-9 shrink-0">
                        <Plus size={15} /> {t('resourceList.create')}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-muted)]">
                <span><strong className="font-semibold text-[var(--text-main)]">{resources.length}</strong> {t('resourceList.total')}</span>
                <span><strong className="font-semibold text-[var(--text-main)]">{boundCount}</strong> {t('resourceList.bound')}</span>
                <span><strong className="font-semibold text-[var(--text-main)]">{resources.length - boundCount}</strong> {t('resourceList.unbound')}</span>
                <span><strong className="font-semibold text-[var(--text-main)]">{bindingCount}</strong> {t('resourceList.bindingReferences')}</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed text-xs">
                    <thead className="bg-[var(--bg-card)] text-left text-[var(--text-muted)]">
                        <tr>
                            <th className="w-[30%] px-3 py-2 font-medium">{t('resourceList.resource')}</th>
                            <th className="w-[38%] px-3 py-2 font-medium">{t('resourceList.bindings')}</th>
                            <th className="w-44 px-3 py-2 font-medium">{t('resourceList.created')}</th>
                            <th className="w-24 px-3 py-2 text-right font-medium">{t('resourceList.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                        {loading ? (
                            <tr><td colSpan={4} className="h-36"><Loader2 size={20} className="mx-auto animate-spin text-[var(--text-muted)]" /></td></tr>
                        ) : visible.map(resource => {
                            const references = bindings.get(resource.id) || [];
                            return (
                                <tr key={resource.id} className="hover:bg-[var(--bg-hover)]">
                                    <td className="px-3 py-2">
                                        <div className="truncate font-medium text-[var(--text-main)]">{resource.name}</div>
                                        <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">{resource.id}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {references.length === 0 ? <span className="text-[var(--text-muted)]">{t('resourceList.notBound')}</span> : (
                                            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                                                {references.slice(0, 3).map(reference => (
                                                    <span key={`${reference.projectId}:${reference.varName}`} className="max-w-48 truncate font-mono text-[11px] text-[var(--text-main)]" title={`${reference.projectName}:${reference.varName}`}>
                                                        {reference.projectName}:{reference.varName}
                                                    </span>
                                                ))}
                                                {references.length > 3 && <span className="text-[var(--text-muted)]">+{references.length - 3}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-[var(--text-muted)]">{new Date(resource.created).toLocaleString()}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex justify-end gap-1">
                                            <button type="button" onClick={() => onManage(resource)} className="console-icon-button" title={t('resourceList.manage')}><Settings2 size={15} /></button>
                                            <button type="button" onClick={() => void handleDelete(resource)} className="console-icon-button text-red-500" title={t('resourceList.delete')}><Trash2 size={15} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && visible.length === 0 && (
                            <tr><td colSpan={4} className="h-36 text-center text-sm text-[var(--text-muted)]">{normalizedQuery ? t('resourceList.noMatches') : emptyLabel}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex min-h-11 items-center justify-between border-t border-[var(--border-color)] px-3 text-xs text-[var(--text-muted)]">
                <span>{t('resourceList.resultCount', { count: filtered.length })}</span>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="console-icon-button" title={t('resourceList.previous')}><ChevronLeft size={15} /></button>
                    <span className="w-20 text-center">{t('resourceList.page', { page, count: pageCount })}</span>
                    <button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="console-icon-button" title={t('resourceList.next')}><ChevronRight size={15} /></button>
                </div>
            </div>
        </div>
    );
}
