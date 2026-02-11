export interface Project {
    id: string;
    name: string;
    type: 'worker' | 'pages';
    port: number;
    status: 'running' | 'stopped';
    mainFile: string;
    bindings: Bindings;
    envVars: EnvVars;
    buildCommand?: string;
    outputDir?: string;
    deployCommand?: string;
    createdAt: string;
    portInUse?: boolean;
}

export interface Bindings {
    kv: BindingItem[];
    d1: BindingItem[];
    r2: BindingItem[];
}

export interface BindingItem {
    varName: string;
    resourceId: string;
}

export interface EnvVars {
    [key: string]: {
        type: 'plain' | 'secret' | 'json';
        value: string | any;
    };
}

export interface KVNamespace {
    id: string;
    name: string;
    created: string;
}

export interface D1Database {
    id: string;
    name: string;
    created: string;
}

export interface R2Bucket {
    id: string;
    name: string;
    created: string;
}

export interface Resources {
    kv: KVNamespace[];
    d1: D1Database[];
    r2: R2Bucket[];
}

export interface FileNode {
    name: string;
    path: string;
    size: number;
    isDirectory?: boolean; // API might return this for unified structure? check files.js
}

export interface AuthResponse {
    success?: boolean;
    token?: string;
    error?: string;
}
