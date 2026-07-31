import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RouterContext, type LocationState, type NavigateFunction } from './router-context';
import { useNavigate } from './use-router';

function normalizeInternalPath(path: string) {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
        throw new Error('Navigation path must be an internal absolute path');
    }
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error('Cross-origin navigation is forbidden');
    return `${url.pathname}${url.search}${url.hash}`;
}

export const Router: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [location, setLocation] = useState<LocationState>({
        pathname: `${window.location.pathname}${window.location.search}`,
        state: window.history.state
    });

    useEffect(() => {
        const handlePopState = () => setLocation({
            pathname: `${window.location.pathname}${window.location.search}`,
            state: window.history.state
        });
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigate = useCallback<NavigateFunction>((path, options = {}) => {
        const target = normalizeInternalPath(path);
        if (options.replace) window.history.replaceState(options.state ?? null, '', target);
        else window.history.pushState(options.state ?? null, '', target);
        setLocation({ pathname: `${window.location.pathname}${window.location.search}`, state: options.state ?? null });
    }, []);

    const value = useMemo(() => ({ ...location, navigate }), [location, navigate]);
    return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const Navigate: React.FC<{ to: string; replace?: boolean; state?: unknown }> = ({ to, replace, state }) => {
    const navigate = useNavigate();
    useEffect(() => navigate(to, { replace, state }), [navigate, replace, state, to]);
    return null;
};
