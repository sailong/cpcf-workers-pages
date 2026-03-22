import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

export const getToken = () => localStorage.getItem('auth_token');
export const setToken = (token: string) => localStorage.setItem('auth_token', token);
export const removeToken = () => localStorage.removeItem('auth_token');

const instance = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request interceptor for API calls
instance.interceptors.request.use(
    async config => {
        const token = getToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Response interceptor for API calls
instance.interceptors.response.use(
    (response) => response,
    async function (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            removeToken();
            window.dispatchEvent(new Event('auth:expired'));
        }
        return Promise.reject(error);
    }
);

/**
 * Validates the token explicitly
 */
export const checkAuth = async (): Promise<boolean> => {
    const token = getToken();
    if (!token) return false;
    try {
        await instance.get('/verify-token');
        return true;
    } catch (e) {
        removeToken();
        return false;
    }
};

const api = {
    get: <T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> => {
        return instance.get(url, config);
    },
    post: <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
        return instance.post(url, data, config);
    },
    put: <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
        return instance.put(url, data, config);
    },
    patch: <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
        return instance.patch(url, data, config);
    },
    delete: <T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> => {
        return instance.delete(url, config);
    },
    // For manual handling
    axiosInstance: instance
};

export { api };

export const authenticatedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getToken();
    const headers = new Headers(init?.headers);

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const config = {
        ...init,
        headers
    };

    const response = await fetch(input, config);

    if (response.status === 401 || response.status === 403) {
        removeToken();
        window.dispatchEvent(new Event('auth:expired'));
    }

    return response;
};

export default api;
