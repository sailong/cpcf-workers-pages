import api from './api';
import type { Resources } from '../types';

export const ResourceService = {
    // KV
    getKV: async () => {
        const res = await api.get('/resources/kv');
        return res.data;
    },
    createKV: async (name: string) => {
        const res = await api.post('/resources/kv', { name });
        return res.data;
    },
    deleteKV: async (id: string) => {
        const res = await api.delete(`/resources/kv/${id}`);
        return res.data;
    },
    listKeys: async (id: string, prefix = '', limit = 1000) => {
        const res = await api.get(`/resources/kv/${id}/keys`, { params: { prefix, limit } });
        return res.data;
    },
    getValue: async (id: string, key: string) => {
        const res = await api.get(`/resources/kv/${id}/values/${key}`);
        return res.data;
    },
    setValue: async (id: string, key: string, value: any) => {
        const res = await api.put(`/resources/kv/${id}/values/${key}`, { value });
        return res.data;
    },
    deleteKey: async (id: string, key: string) => {
        const res = await api.delete(`/resources/kv/${id}/values/${key}`);
        return res.data;
    },

    // D1
    getD1: async () => {
        const res = await api.get('/resources/d1');
        return res.data;
    },
    createD1: async (name: string) => {
        const res = await api.post('/resources/d1', { name });
        return res.data;
    },
    deleteD1: async (id: string) => {
        const res = await api.delete(`/resources/d1/${id}`);
        return res.data;
    },
    executeSQL: async (id: string, sql: string) => {
        const res = await api.post(`/resources/d1/${id}/execute`, { sql });
        return res.data;
    },
    listTables: async (id: string) => {
        const res = await api.get(`/resources/d1/${id}/tables`);
        return res.data;
    },
    queryTable: async (id: string, table: string, limit = 100) => {
        const res = await api.get(`/resources/d1/${id}/query`, { params: { table, limit } });
        return res.data;
    },

    // R2
    getR2: async () => {
        const res = await api.get('/resources/r2');
        return res.data;
    },
    createR2: async (name: string) => {
        const res = await api.post('/resources/r2', { name });
        return res.data;
    },
    deleteR2: async (id: string) => {
        const res = await api.delete(`/resources/r2/${id}`);
        return res.data;
    },
    listFiles: async (id: string, prefix = '', cursor = '', limit = 100, delimiter = '/') => {
        const res = await api.get(`/resources/r2/${id}/files`, { params: { prefix, cursor, limit, delimiter } });
        return res.data;
    },
    uploadFile: async (id: string, file: File, key?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (key) formData.append('key', key);
        const res = await api.post(`/resources/r2/${id}/files`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },
    deleteFile: async (id: string, key: string) => {
        const res = await api.delete(`/resources/r2/${id}/files/${key}`);
        return res.data;
    },
    getFileUrl: (id: string, key: string) => `/api/resources/r2/${id}/files/${key}`
};
