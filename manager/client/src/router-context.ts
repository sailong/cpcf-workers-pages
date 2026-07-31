import { createContext } from 'react';

export interface LocationState {
    pathname: string;
    state: unknown;
}

export interface NavigateOptions {
    replace?: boolean;
    state?: unknown;
}

export type NavigateFunction = (path: string, options?: NavigateOptions) => void;

export interface RouterValue extends LocationState {
    navigate: NavigateFunction;
}

export const RouterContext = createContext<RouterValue | null>(null);
