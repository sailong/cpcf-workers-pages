export const getToken = () => localStorage.getItem('token');
export const setToken = (token: string) => localStorage.setItem('token', token);
export const removeToken = () => localStorage.removeItem('token');

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

    // Handle authentication errors (401 = no token, 403 = invalid/expired token)
    if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        removeToken();
        // Dispatch event for UI to handle (show toast then redirect)
        window.dispatchEvent(new Event('auth:expired'));
    }

    return response;
};
