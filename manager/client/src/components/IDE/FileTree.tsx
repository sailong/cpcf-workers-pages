import React, { useEffect, useState } from 'react';
import { ProjectService, FileService } from '../../services';
import type { FileNode } from '../../types';

interface FileTreeProps {
    projectId: string;
    onSelect: (path: string) => void;
    selectedPath: string | null;
}

const FileTree: React.FC<FileTreeProps> = ({ projectId, onSelect, selectedPath }) => {
    const [files, setFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadFiles();
    }, [projectId]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await FileService.listFiles(projectId);
            setFiles(data);
            if (data.length > 0 && !selectedPath) {
                const index = data.find(f => f.name === 'index.html') || data[0];
                onSelect(index.path);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4 text-gray-500 text-xs text-center">Loading...</div>;
    if (files.length === 0) return <div className="p-4 text-gray-500 text-xs text-center">No files found.</div>;

    return (
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {files.map((file, i) => (
                <button
                    key={file.path}
                    onClick={() => onSelect(file.path)}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm truncate font-mono transition-colors ${selectedPath === file.path
                        ? 'bg-purple-900/50 text-purple-200 border-l-2 border-purple-500'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                    title={file.path}
                >
                    {file.name}
                </button>
            ))}
        </div>
    );
};

export default FileTree;
