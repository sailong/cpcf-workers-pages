import api from './api';
import type { FileNode } from '../types';

export const FileService = {
    listFiles: async (projectId: string): Promise<FileNode[]> => {
        const res = await api.get(`/projects/${projectId}/files`);
        return res.data;
    },

    readContent: async (projectId: string, path: string): Promise<string> => {
        const res = await api.get(`/projects/${projectId}/files/content`, { params: { path } });
        return res.data.content;
    },

    writeContent: async (projectId: string, path: string, content: string) => {
        const res = await api.put(`/projects/${projectId}/files/content`, { path, content });
        return res.data;
    },

    // Helper to upload generic file (for build/deploy or just assets)
    // Note: The main project creation upload is handled in ProjectService.create 
    // or separate upload endpoint.
    // server.js has `/api/upload` endpoint.
    uploadFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    }
};
