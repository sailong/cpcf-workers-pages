import api from './api';
import type { AuditEvent, ProjectDeployment } from '../types';

export const OperationsService = {
    getDeployments: async (limit = 100): Promise<ProjectDeployment[]> => {
        const response = await api.get<ProjectDeployment[]>('/operations/deployments', { params: { limit } });
        return response.data;
    },

    getAuditEvents: async (limit = 100): Promise<AuditEvent[]> => {
        const response = await api.get<AuditEvent[]>('/operations/audit-events', { params: { limit } });
        return response.data;
    }
};
