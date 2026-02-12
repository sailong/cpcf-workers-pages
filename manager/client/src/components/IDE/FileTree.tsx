import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileService } from '../../services';
import type { FileNode } from '../../types';

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
    const [files, setFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    // Tree state: expanded directories set
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadFiles();
    }, [projectId]);

    const loadFiles = async () => {
        setLoading(true);
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
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

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

                let existing = current.children.find(c => c.name === part);
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

    if (loading) return <div className="p-4 text-gray-500 text-xs text-center">{t('ide.fileTree.loading')}</div>;
    if (files.length === 0) return <div className="p-4 text-gray-500 text-xs text-center">{t('ide.fileTree.noFiles')}</div>;

    const renderNode = (node: TreeNode, depth: number) => {
        const isExpanded = expanded.has(node.path);
        const isSelected = selectedPath === node.path;
        const paddingLeft = `${depth * 12 + 12}px`; // Indent

        if (node.isDirectory) {
            return (
                <div key={node.path}>
                    <button
                        onClick={() => toggleExpand(node.path)}
                        className={`w-full text-left py-1 text-sm font-mono flex items-center gap-1 hover:bg-gray-800 text-gray-300 transition-colors`}
                        style={{ paddingLeft }}
                    >
                        <span className="text-[10px] w-4 text-center">{isExpanded ? '▼' : '▶'}</span>
                        <span className="text-yellow-500">📁</span>
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
                    key={node.path}
                    onClick={() => onSelect(node.path)}
                    className={`w-full text-left py-1 text-sm font-mono flex items-center gap-2 transition-colors
                        ${isSelected
                            ? 'bg-purple-900/50 text-purple-200 border-r-2 border-purple-500'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                        }`}
                    style={{ paddingLeft: `${depth * 12 + 28}px` }} // Align with folder text
                >
                    <span className="text-blue-400">📄</span>
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
