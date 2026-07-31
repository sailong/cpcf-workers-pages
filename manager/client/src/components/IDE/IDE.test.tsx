import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import type { Project } from '../../types';
import IDE from './IDE';

vi.mock('../../services', () => ({
  ProjectService: { getCode: vi.fn().mockResolvedValue({ code: 'export default {}', language: 'javascript' }), updateCode: vi.fn() },
  FileService: { readContent: vi.fn(), writeContent: vi.fn() }
}));
vi.mock('../../contexts/feedback-context', () => ({ useFeedback: () => ({ notify: vi.fn() }) }));
vi.mock('./Editor', () => ({ default: ({ readOnly }: { readOnly?: boolean }) => <div data-testid="editor-panel" data-readonly={readOnly ? 'true' : 'false'}>editor-panel</div> }));
vi.mock('./FileTree', () => ({ default: () => <div>file-tree</div> }));
vi.mock('./ConfigPanel', () => ({ default: ({ view }: { view: string }) => <div>config-{view}</div> }));
vi.mock('./DeployPanel', () => ({ default: () => <div>upload-deployment</div> }));
vi.mock('./ReleasesPanel', () => ({ default: () => <div>release-history</div> }));
vi.mock('./DeploymentsPanel', () => ({ default: () => <div>deployment-activity</div> }));
vi.mock('./RuntimeLogsPanel', () => ({ default: () => <div>runtime-logs</div> }));

const project: Project = {
  id: 'project-pages', name: 'docs', type: 'pages', port: 10001, status: 'running', mainFile: 'index.html',
  activeReleaseId: 'release-1234567890', bindings: { kv: [], d1: [], r2: [] }, envVars: {},
  compatibilityDate: '2026-07-30', compatibilityFlags: [], createdAt: '2026-07-30T00:00:00.000Z',
  limits: { cpu: 1, memoryMb: 128, diskMb: 256, uploadMb: 10, concurrentRequests: 10, buildTimeoutSeconds: 60, pids: 32 }
};

describe('IDE project workspace', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });

  it('organizes project workflows into operations-console views', () => {
    render(<IDE project={project} onClose={vi.fn()} onSaved={vi.fn()} />);

    for (const name of ['Overview', 'Code', 'Deployments', 'Bindings', 'Logs', 'Settings']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Project overview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Bindings' }));
    expect(screen.getByText('config-bindings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByText('config-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Deployments' }));
    expect(screen.getByText('release-history')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Activity and logs' }));
    expect(screen.getByText('deployment-activity')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Upload deployment' }));
    expect(screen.getByText('upload-deployment')).toBeInTheDocument();
  });

  it('keeps Pages source read-only and routes edits through a new deployment', () => {
    render(<IDE project={project} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));
    expect(screen.getByTestId('editor-panel')).toHaveAttribute('data-readonly', 'true');
    expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Upload deployment' }));
    expect(screen.getByRole('tab', { name: 'Upload deployment' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('upload-deployment')).toBeInTheDocument();
  });
});
