import api from './api';
import type { Project } from '../types';

export const ProjectService = {
    getAll: async (): Promise<Project[]> => {
        const res = await api.get('/projects');
        return res.data;
    },

    create: async (data: Partial<Project>) => {
        const res = await api.post('/projects', data);
        return res.data;
    },

    start: async (id: string, force: boolean = false) => {
        const res = await api.post(`/projects/${id}/start`, { force });
        return res.data;
    },

    stop: async (id: string) => {
        const res = await api.post(`/projects/${id}/stop`);
        return res.data;
    },

    delete: async (id: string) => {
        const res = await api.delete(`/projects/${id}`);
        return res.data;
    },

    getCode: async (id: string) => {
        const res = await api.get(`/projects/${id}/code`);
        return res.data;
    },

    updateCode: async (id: string, code: string) => {
        const res = await api.put(`/projects/${id}/code`, { code });
        return res.data;
    },

    updateConfig: async (id: string, config: Partial<Project>) => {
        const res = await api.patch(`/projects/${id}`, config);
        return res.data;
    },

    rebuild: async (id: string, data: any, onLog: (msg: string) => void) => {
        // SSE implementation requires native EventSource or fetch
        // Axios doesn't support streams well comfortably for SSE
        // Using native fetch for SSE
        const response = await fetch(`/api/projects/${id}/rebuild`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    let message;
                    try {
                        message = JSON.parse(jsonStr);
                    } catch (e) {
                        continue; // Ignore partial or invalid JSON
                    }

                    if (message.type === 'log') onLog(message.content);
                    if (message.type === 'error') throw new Error(message.content);
                    if (message.type === 'result') return message;
                }
            }
        }
    },

    // Deploy Build Artifact to Existing Project
    deploy: async (id: string, buildId: string, outputDir: string, onLog: (msg: string) => void, onError: (msg: string) => void) => {
        const response = await fetch(`/api/projects/${id}/deploy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ buildId, outputDir })
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    let message;
                    try {
                        message = JSON.parse(jsonStr);
                    } catch (e) {
                        continue; // Ignore partial or invalid JSON
                    }

                    if (message.type === 'log') onLog(message.content);
                    if (message.type === 'error') onError(message.content);
                    if (message.type === 'result') return message;
                }
            }
        }
    }
};
