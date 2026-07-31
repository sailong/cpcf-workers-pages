import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import type { Project } from '../../types';
import { ProjectService, ResourceService } from '../../services';
import { FeedbackProvider } from '../ui/FeedbackProvider';
import ConfigPanel from './ConfigPanel';

vi.mock('../../services', () => ({
  ProjectService: { getAll: vi.fn(), updateConfig: vi.fn() },
  ResourceService: { getKV: vi.fn(), getD1: vi.fn(), getR2: vi.fn() }
}));

const project: Project = {
  id: 'worker-one', name: 'worker-one', type: 'worker', port: 10001, status: 'stopped', mainFile: 'worker.js',
  bindings: { kv: [], d1: [], r2: [] }, envVars: {}, compatibilityDate: '2026-07-30', compatibilityFlags: [],
  limits: { cpu: 1, memoryMb: 128, diskMb: 256, uploadMb: 10, concurrentRequests: 10, buildTimeoutSeconds: 60, pids: 32 },
  createdAt: '2026-07-30T00:00:00.000Z'
};

describe('ConfigPanel', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProjectService.getAll).mockResolvedValue([project]);
    vi.mocked(ProjectService.updateConfig).mockResolvedValue(project);
    vi.mocked(ResourceService.getKV).mockResolvedValue([{ id: 'kv-one', name: 'cache', created: project.createdAt }]);
    vi.mocked(ResourceService.getD1).mockResolvedValue([]);
    vi.mocked(ResourceService.getR2).mockResolvedValue([]);
  });

  it('blocks saving after a load failure and recovers through retry', async () => {
    vi.mocked(ProjectService.getAll).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([project]);

    render(<FeedbackProvider><ConfigPanel project={project} view="bindings" onSave={vi.fn()} /></FeedbackProvider>);

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Resource Bindings' })).toBeVisible();
  });

  it('adds, saves, and removes a KV binding without mutating stale state', async () => {
    const onSave = vi.fn();
    render(<FeedbackProvider><ConfigPanel project={project} view="bindings" onSave={onSave} /></FeedbackProvider>);
    await screen.findByRole('heading', { name: 'Resource Bindings' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Variable Name'), { target: { value: 'CACHE' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Select KV Namespace' }), { target: { value: 'kv-one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(ProjectService.updateConfig).toHaveBeenCalled());
    expect(vi.mocked(ProjectService.updateConfig).mock.calls.at(-1)?.[1].bindings).toEqual({
      kv: [{ varName: 'CACHE', resourceId: 'kv-one' }], d1: [], r2: []
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Delete'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ProjectService.updateConfig).toHaveBeenCalledTimes(2));
    expect(vi.mocked(ProjectService.updateConfig).mock.calls.at(-1)?.[1].bindings?.kv).toEqual([]);
  });
});
