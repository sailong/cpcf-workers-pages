import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from './api';

interface R2ManagerProps {
    bucket: { id: string; name: string };
    onClose: () => void;
}

interface R2Object {
    key: string;
    size: number;
    etag: string;
    uploaded: string;
}

const R2Manager: React.FC<R2ManagerProps> = ({ bucket, onClose }) => {
    const [files, setFiles] = useState<R2Object[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadFiles = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files`);
            if (!res.ok) {
                let errorMsg = '加载文件失败';
                try {
                    const text = await res.text();
                    errorMsg += ': ' + text;
                } catch (e) {
                    errorMsg += ' (HTTP ' + res.status + ')';
                }
                throw new Error(errorMsg);
            }
            const data = await res.json();
            // data.objects is the array
            setFiles(data.objects || []);
        } catch (err: any) {
            setError(err.message || '加载文件失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [bucket]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error(await res.text());

            await loadFiles();
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
            setError('上传失败: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (key: string) => {
        // Confirmation is implicit or use a nicer modal? 
        // For consistency use window.confirm or custom modal. 
        // D1Manager doesn't seem to use a complex delete modal for rows, but App does for resources.
        // Let's stick to window.confirm for now or simple UI toggle.
        if (!window.confirm(`确定删除 ${key}?`)) return;

        try {
            const res = await authenticatedFetch(`/api/resources/r2/${bucket.id}/files/${encodeURIComponent(key)}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error(await res.text());
            await loadFiles();
        } catch (err: any) {
            setError('删除失败: ' + err.message);
        }
    };

    const getDownloadUrl = (key: string) => `/api/resources/r2/${bucket.id}/files/${key}`;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-8">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-950/50 rounded-t-xl">
                    <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                        <span className="bg-yellow-500/10 text-yellow-500 p-2 rounded-lg text-xl">🪣</span>
                        R2 文件管理: <span className="text-yellow-500 font-mono">{bucket.name}</span>
                    </h2>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${uploading
                                ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                                : 'bg-yellow-600 hover:bg-yellow-500 text-black shadow-lg shadow-yellow-900/20'
                                }`}
                        >
                            {uploading ? '⏳ 上传中...' : '📤 上传文件'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-gray-950">
                    {error && (
                        <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                            ⚠️ {error}
                        </div>
                    )}

                    {loading && files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <div className="w-8 h-8 border-2 border-gray-600 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
                            <p>正在加载文件列表...</p>
                        </div>
                    ) : (
                        <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-800/80 text-gray-400 font-medium border-b border-gray-700 uppercase text-xs sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-3 w-1/2">文件名 (Key)</th>
                                        <th className="px-6 py-3">大小 (Size)</th>
                                        <th className="px-6 py-3">上传时间 (Uploaded)</th>
                                        <th className="px-6 py-3 text-right">操作 (Actions)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {files.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-16 text-center text-gray-600">
                                                <div className="text-4xl mb-4 opacity-30">📭</div>
                                                <p>暂无文件，点击右上角上传</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        files.map((obj) => (
                                            <tr key={obj.key} className="hover:bg-gray-800/50 group transition-colors">
                                                <td className="px-6 py-4 font-mono text-gray-300 break-all flex items-center gap-3">
                                                    <span className="opacity-50 text-lg">📄</span>
                                                    {obj.key}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-mono">{formatSize(obj.size)}</td>
                                                <td className="px-6 py-4 text-gray-500 text-xs">
                                                    {new Date(obj.uploaded).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <a
                                                            href={getDownloadUrl(obj.key)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300 text-xs font-medium hover:underline flex items-center gap-1"
                                                            download
                                                        >
                                                            ⬇️ 下载
                                                        </a>
                                                        <button
                                                            onClick={() => handleDelete(obj.key)}
                                                            className="text-red-500 hover:text-red-400 text-xs font-medium hover:underline flex items-center gap-1"
                                                        >
                                                            🗑️ 删除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-gray-800 bg-gray-900 text-xs text-gray-500 flex justify-between">
                    <span>提示: 列表可能会有短暂延迟 (本地模拟环境)</span>
                    <span>共 {files.length} 个文件</span>
                </div>
            </div>
        </div>
    );
};

export default R2Manager;
