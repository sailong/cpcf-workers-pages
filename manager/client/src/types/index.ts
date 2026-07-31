export interface Project {
    id: string;
    name: string;
    type: 'worker' | 'pages';
    port: number;
    status: 'running' | 'stopped';
    mainFile: string;
    activeReleaseId?: string | null;
    bindings: Bindings;
    envVars: EnvVars;
    buildCommand?: string;
    outputDir?: string;
    compatibilityDate: string;
    compatibilityFlags: string[];
    limits: ProjectLimits;
    createdAt: string;
    portInUse?: boolean;
    metrics?: ProjectRuntimeMetrics;
    lastDeployment?: ProjectDeployment | null;
}

export interface ProjectLimits {
    cpu: number;
    memoryMb: number;
    diskMb: number;
    uploadMb: number;
    concurrentRequests: number;
    buildTimeoutSeconds: number;
    pids: number;
}

export interface PlatformConfig {
    managerPort: number;
    projectBaseDomain: string;
    projectProtocol: string;
    projectPort: string;
}

export interface ProjectRelease {
    id: string;
    projectId: string;
    checksum: string;
    entryPath: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    activatedAt?: string | null;
    active: boolean;
}

export interface DeploymentLog {
    timestamp: string;
    level: 'info' | 'error';
    content: string;
}

export interface ProjectDeployment {
    id: string;
    projectId: string;
    status: 'running' | 'succeeded' | 'failed' | 'interrupted';
    kind: 'rebuild' | 'deploy';
    metadata: Record<string, unknown>;
    logs: DeploymentLog[];
    startedAt: string;
    completedAt?: string | null;
    result?: Record<string, unknown> | null;
    createdAt: string;
    projectName?: string;
    projectType?: 'worker' | 'pages';
}

export interface AuditEvent {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    details: Record<string, unknown>;
    createdAt: string;
}

export interface NetworkProbe {
    ok: boolean;
    addresses?: string[];
    error?: string;
}

export interface CertificateProbe {
    ok: boolean;
    authorized?: boolean;
    authorizationError?: string | null;
    subject?: string | null;
    issuer?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
    daysRemaining?: number | null;
    error?: string;
}

export interface SystemStatus {
    configuration: {
        consoleHost: string;
        projectsBaseDomain: string;
        projectWildcard: string;
        observedHost: string;
        observedHostMatches: boolean;
        dnsProviderConfigured: boolean;
        acmeEmailConfigured: boolean;
        ingressProxyConfigured: boolean;
        confirmation: {
            confirmed: boolean;
            confirmedAt?: string;
            confirmedFromHost?: string;
            updatedAt?: string;
        };
    };
    dns: { console: NetworkProbe; wildcard: NetworkProbe; probeHost: string };
    tls: { console: CertificateProbe; wildcard: CertificateProbe; probeHost: string };
    warnings: string[];
    healthy: boolean;
    checkedAt: string;
}

export interface ProjectRuntimeMetrics {
    supported: boolean;
    running: boolean;
    cpuPercent: number | null;
    memoryBytes: number | null;
    memoryLimitBytes: number;
    pids: number | null;
    storageBytes: number;
    storageLimitBytes: number;
    concurrentRequests: number;
    concurrencyLimit: number;
    collectedAt: string | null;
}

export interface RuntimeLog {
    id: number;
    projectId: string;
    stream: 'stdout' | 'stderr' | 'system';
    content: string;
    createdAt: string;
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
        value: JsonValue;
    };
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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

export interface TrashedResource {
    id: string;
    name: string;
    kind: 'kv' | 'd1' | 'r2';
    created: string;
    deletedAt: string;
    purgeAfter: string;
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
    requirePasswordChange?: boolean;
    error?: string;
}
