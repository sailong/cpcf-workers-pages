import { describe, expect, it } from 'vitest';
import type { PlatformConfig, Project } from '../types';
import { projectPublicUrl } from './project-url';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-one',
  name: 'Project-One',
  type: 'worker',
  port: 8787,
  status: 'running',
  mainFile: 'projects/project-one/releases/release-one/artifact/index.js',
  bindings: { kv: [], d1: [], r2: [] },
  envVars: {},
  compatibilityDate: '2024-09-23',
  compatibilityFlags: ['nodejs_compat'],
  limits: {
    cpu: 1,
    memoryMb: 256,
    diskMb: 512,
    uploadMb: 50,
    concurrentRequests: 100,
    buildTimeoutSeconds: 300,
    pids: 64
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const config = (overrides: Partial<PlatformConfig> = {}): PlatformConfig => ({
  managerPort: 8001,
  projectBaseDomain: 'apps.example.com',
  projectProtocol: 'https',
  projectPort: '',
  ...overrides
});

describe('projectPublicUrl', () => {
  it('builds the canonical worker subdomain', () => {
    expect(projectPublicUrl(project(), config())).toBe('https://project-one-worker.apps.example.com');
  });

  it('normalizes protocol punctuation and preserves an explicit port', () => {
    expect(projectPublicUrl(project({ type: 'pages' }), config({ projectProtocol: 'http:', projectPort: '18001' })))
      .toBe('http://project-one-pages.apps.example.com:18001');
  });
});
