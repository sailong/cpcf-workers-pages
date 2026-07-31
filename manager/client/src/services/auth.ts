import api from './api';
import axios from 'axios';
import type { AuthResponse } from '../types';

export const AuthService = {
    login: async (username: string, password: string, captcha: string, captchaId: string): Promise<AuthResponse> => {
        try {
            const res = await api.post('/login', { username, password, captcha, captchaId });
            return res.data;
        } catch (error: unknown) {
            const message = axios.isAxiosError<{ error?: string }>(error)
                ? error.response?.data?.error || error.message
                : error instanceof Error ? error.message : 'Login failed';
            return { success: false, error: message };
        }
    },

    getCaptcha: async () => {
        const res = await api.get('/captcha');
        return res.data;
    },

    changePassword: async (oldPassword: string, newPassword: string) => {
        const res = await api.post('/change-password', { oldPassword, newPassword });
        window.dispatchEvent(new Event('auth:expired'));
        return res.data;
    },

    logout: async () => {
        await api.post('/logout');
        window.dispatchEvent(new Event('auth:expired'));
    },
};
