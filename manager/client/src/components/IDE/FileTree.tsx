import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileService } from '../../services';
import type { FileNode } from '../../types';
import { ChevronDown, ChevronRight, File, Folder, RefreshCw, TriangleAlert } from 'lucide-react';
import { useFeedback } from '../../contexts/feedback-context';

interface FileTreeProps {
    projectId: string;
    onSelect: (path: string) => void;
    selectedPath: string | null;
}

interface TreeNode {
    name: string;
    path: string; // Directory path or file path
    isDirectory: boolean;
    children: TreeNode[];
}

const FileTree: React.FC<FileTreeProps> = ({ projectId, onSelect, selectedPath }) => {
    const { t } = useTranslation();
    const { notify } = useFeedback();
    const [files, setFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    // Tree state: expanded directories set
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const loadFiles = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const data = await FileService.listFiles(projectId);
            setFiles(data);

            // Default select index.html if available and nothing selected
            if (data.length > 0 && !selectedPath) {
                const index = data.find(f => f.name === 'index.html') || data[0];
                onSelect(index.path);
            }
            // Auto expand root
            setExpanded(new Set(['']));
        } catch {
            setLoadError(true);
            notify(t('ide.fileTree.loadFailed'), 'error');
        } finally {
            setLoading(false);
        }
    }, [notify, onSelect, projectId, selectedPath, t]);

    useEffect(() => {
        void loadFiles();
    }, [loadFiles]);

    // Convert flat file list to Tree Structure
    const tree = useMemo(() => {
        const root: TreeNode = { name: '', path: '', isDirectory: true, children: [] };

        files.forEach(file => {
            const parts = file.path.split('/');
            let current = root;

            parts.forEach((part, index) => {
                const isLate = index === parts.length - 1;
                // Avoid empty parts
                if (!part) return;

                const existing = current.children.find(c => c.name === part);
                if (!existing) {
                    const nodePath = parts.slice(0, index + 1).join('/');
                    const newNode: TreeNode = {
                        name: part,
                        path: nodePath,
                        isDirectory: !isLate || (file.isDirectory === true),
                        children: []
                    };
                    current.children.push(newNode);
                    current = newNode;
                } else {
                    current = existing;
                }
            });
        });

        // Sort: Directories first, then files
        const sortNodes = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
            });
            nodes.forEach(n => sortNodes(n.children));
        };
        sortNodes(root.children);

        return root.children;
    }, [files]);

    const toggleExpand = (path: string) => {
        const next = new Set(expanded);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setExpanded(next);
    };

    if (loading) return <div className="p-4 text-center text-xs text-[var(--text-muted)]">{t('ide.fileTree.loading')}</div>;
    if (loadError) return <div role="alert" className="flex flex-col items-center gap-3 p-4 text-center text-xs text-[var(--color-danger)]"><TriangleAlert size={18} aria-hidden="true" /><span>{t('ide.fileTree.loadFailed')}</span><button type="button" className="console-button secondary" onClick={() => void loadFiles()}><RefreshCw size={13} aria-hidden="true" />{t('common.retry')}</button></div>;
    if (files.length === 0) return <div className="p-4 text-center text-xs text-[var(--text-muted)]">{t('ide.fileTree.noFiles')}</div>;

    const renderNode = (node: TreeNode, depth: number) => {
        const isExpanded = expanded.has(node.path);
        const isSelected = selectedPath === node.path;
        const paddingLeft = `${depth * 12 + 12}px`; // Indent

        if (node.isDirectory) {
            return (
                <div key={node.path}>
                    <button
                        type="button"
                        onClick={() => toggleExpand(node.path)}
                        className="flex w-full items-center gap-1 py-1 text-left font-mono text-sm text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
                        style={{ paddingLeft }}
                    >
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <Folder size={14} className="text-amber-500" />
                        {node.name}
                    </button>
                    {isExpanded && (
                        <div>
                            {node.children.map(child => renderNode(child, depth + 1))}
                        </div>
                    )}
                </div>
            );
        } else {
            return (
                <button
                    type="button"
                    key={node.path}
                    onClick={() => onSelect(node.path)}
                    className={`w-full text-left py-1 text-sm font-mono flex items-center gap-2 transition-colors
                        ${isSelected
                            ? 'border-r-2 border-[var(--primary)] bg-[var(--color-primary-light)] text-[var(--text-main)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                        }`}
                    style={{ paddingLeft: `${depth * 12 + 28}px` }} // Align with folder text
                >
                    <File size={14} className="text-blue-500" />
                    {node.name}
                </button>
            );
        }
    };

    return (
        <div className="flex-1 overflow-y-auto py-2">
            {tree.map(node => renderNode(node, 0))}
        </div>
    );
};

export default FileTree;
