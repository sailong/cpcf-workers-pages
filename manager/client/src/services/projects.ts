import api from './api';
import type {
    PlatformConfig,
    Project,
    ProjectDeployment,
    ProjectRelease,
    ProjectRuntimeMetrics,
    RuntimeLog
} from '../types';
import { consumeSSE } from '../utils/sse-stream';

interface RebuildOptions {
    buildCommand: string;
    outputDir: string;
}

export const ProjectService = {
    getAll: async (): Promise<Project[]> => {
        const res = await api.get('/projects');
        return res.data;
    },

    getPlatformConfig: async (): Promise<PlatformConfig> => {
        const res = await api.get<PlatformConfig>('/config');
        return res.data;
    },

    create: async (data: Partial<Project>) => {
        const res = await api.post('/projects', data);
        return res.data;
    },

    start: async (id: string) => {
        const res = await api.post(`/projects/${id}/start`);
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

    getReleases: async (id: string): Promise<ProjectRelease[]> => {
        const res = await api.get<ProjectRelease[]>(`/projects/${id}/releases`);
        return res.data;
    },

    getDeployments: async (id: string, limit = 50): Promise<ProjectDeployment[]> => {
        const res = await api.get<ProjectDeployment[]>(`/projects/${id}/deployments`, { params: { limit } });
        return res.data;
    },

    getRuntimeLogs: async (id: string, limit = 500): Promise<RuntimeLog[]> => {
        const res = await api.get<RuntimeLog[]>(`/projects/${id}/runtime-logs`, { params: { limit } });
        return res.data;
    },

    clearRuntimeLogs: async (id: string): Promise<{ success: boolean; removed: number }> => {
        const res = await api.delete<{ success: boolean; removed: number }>(`/projects/${id}/runtime-logs`);
        return res.data;
    },

    getMetrics: async (id: string): Promise<ProjectRuntimeMetrics> => {
        const res = await api.get<ProjectRuntimeMetrics>(`/projects/${id}/metrics`);
        return res.data;
    },

    activateRelease: async (id: string, releaseId: string) => {
        const res = await api.post(`/projects/${id}/releases/${releaseId}/activate`);
        return res.data;
    },

    rollback: async (id: string) => {
        const res = await api.post(`/projects/${id}/rollback`);
        return res.data;
    },

    rebuild: async (id: string, data: RebuildOptions, onLog: (msg: string) => void) => {
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

        return consumeSSE(response, message => {
            if (message.type === 'log') onLog(String(message.content || ''));
            if (message.type === 'error') throw new Error(String(message.content || 'Build failed'));
            return message.type === 'result';
        });
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

        return consumeSSE(response, message => {
            if (message.type === 'log') onLog(String(message.content || ''));
            if (message.type === 'error') onError(String(message.content || 'Deploy failed'));
            return message.type === 'result';
        });
    }
};
