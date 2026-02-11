import axios from 'axios';

// Get base URL from window location if not set, or default to localhost:3000
// In dev (vite), we proxy /api to 3000. In prod, we serve from same origin.
const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Add Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Handle Auth Errors
api.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        // Clear token on auth error
        // But only if not already on login page to avoid loops?
        // Let's just clear token. The UI should react to missing token.
        if (localStorage.getItem('auth_token')) {
            localStorage.removeItem('auth_token');
            // Force reload or redirect? simpler to let React state update
            window.location.reload();
        }
    }
    return Promise.reject(error);
});

export default api;
