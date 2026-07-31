import api from './api';
import type { SystemStatus } from '../types';

export const SystemService = {
    getStatus: async (): Promise<SystemStatus> => {
        const response = await api.get<SystemStatus>('/system/status');
        return response.data;
    },

    confirmDomains: async (consoleHost: string, projectsBaseDomain: string) => {
        const response = await api.post('/system/domains/confirm', { consoleHost, projectsBaseDomain });
        return response.data;
    }
};
