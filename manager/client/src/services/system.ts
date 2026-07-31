import api from './api';
import type { ApplicationReleaseStatus, SystemStatus } from '../types';

export const SystemService = {
    getStatus: async (): Promise<SystemStatus> => {
        const response = await api.get<SystemStatus>('/system/status');
        return response.data;
    },

    confirmDomains: async (consoleHost: string, projectsBaseDomain: string) => {
        const response = await api.post('/system/domains/confirm', { consoleHost, projectsBaseDomain });
        return response.data;
    },

    getUpgradeStatus: async (): Promise<ApplicationReleaseStatus> => {
        const response = await api.get<ApplicationReleaseStatus>('/system/upgrade');
        return response.data;
    },

    checkUpgrade: async (version?: string): Promise<ApplicationReleaseStatus & { candidate?: Record<string, unknown> }> => {
        const response = await api.post('/system/upgrade/check', version ? { version } : {});
        return response.data;
    },

    upgrade: async (version: string) => {
        const response = await api.post('/system/upgrade', { version });
        return response.data as ApplicationReleaseStatus;
    },

    rollback: async () => {
        const response = await api.post('/system/upgrade/rollback', {});
        return response.data as ApplicationReleaseStatus;
    }
};
