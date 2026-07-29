import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

// Existing service wrappers progressively provide concrete response types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = any;

const instance = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
});

instance.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            window.dispatchEvent(new Event('auth:expired'));
        }
        return Promise.reject(error);
    }
);

export const checkAuth = async (): Promise<boolean> => {
    try {
        await instance.get('/verify-session');
        return true;
    } catch {
        return false;
    }
};

export const logout = async (): Promise<void> => {
    try {
        await instance.post('/logout');
    } finally {
        window.dispatchEvent(new Event('auth:expired'));
    }
};

const api = {
    get: <T = ApiData, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> => instance.get(url, config),
    post: <T = ApiData, R = AxiosResponse<T>>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<R> => instance.post(url, data, config),
    put: <T = ApiData, R = AxiosResponse<T>>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<R> => instance.put(url, data, config),
    patch: <T = ApiData, R = AxiosResponse<T>>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<R> => instance.patch(url, data, config),
    delete: <T = ApiData, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> => instance.delete(url, config),
    axiosInstance: instance
};

export { api };

export const authenticatedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, { ...init, credentials: 'same-origin' });
    if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event('auth:expired'));
    }
    return response;
};

export default api;
