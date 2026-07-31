import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import i18n from '../../i18n';
import { FileService } from '../../services';
import FileTree from './FileTree';

vi.mock('../../services', () => ({
  FileService: { listFiles: vi.fn() }
}));

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../../contexts/feedback-context', () => ({
  useFeedback: () => ({ notify, confirm: vi.fn() })
}));

describe('FileTree', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });

  it('shows a retryable error and recovers after a failed file listing', async () => {
    const listFiles = vi.mocked(FileService.listFiles);
    listFiles.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([
      { name: 'index.html', path: 'index.html', size: 12 }
    ]);
    const onSelect = vi.fn();

    render(<FileTree projectId="pages-one" selectedPath={null} onSelect={onSelect} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load project files');
    expect(notify).toHaveBeenCalledWith('Failed to load project files', 'error');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'index.html' })).toBeVisible();
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('index.html'));
  });
});
