import api from './api';
import type { AuthResponse } from '../types';

export const AuthService = {
    login: async (username: string, password: string, captcha: string, captchaId: string): Promise<AuthResponse> => {
        try {
            const res = await api.post('/login', { username, password, captcha, captchaId });
            return res.data;
        } catch (error: any) {
            return { success: false, error: error.response?.data?.error || error.message };
        }
    },

    getCaptcha: async () => {
        const res = await api.get('/captcha');
        return res.data;
    },

    changePassword: async (oldPassword: string, newPassword: string) => {
        const res = await api.post('/change-password', { oldPassword, newPassword });
        return res.data;
    }
};

