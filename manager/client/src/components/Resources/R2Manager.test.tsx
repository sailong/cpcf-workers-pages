import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import { FeedbackProvider } from '../ui/FeedbackProvider';
import R2Manager from './R2Manager';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('R2Manager', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  afterEach(() => vi.unstubAllGlobals());

  it('requires confirmation before deleting an object and refreshes to empty state', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    let deleted = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      requests.push({ url, method });
      if (method === 'DELETE') {
        deleted = true;
        return json({ success: true });
      }
      if (url.includes('/files?')) return json({
        objects: deleted ? [] : [{ key: 'artifact.zip', size: 2048, etag: 'etag-one', uploaded: '2026-07-30T00:00:00.000Z' }],
        truncated: false
      });
      return json({ error: 'Unexpected request' }, 500);
    }));

    render(<FeedbackProvider><R2Manager bucket={{ id: 'r2-one', name: 'artifacts' }} onClose={vi.fn()} /></FeedbackProvider>);
    expect(await screen.findByText('artifact.zip')).toBeVisible();

    fireEvent.click(screen.getByTitle('Delete'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('artifact.zip');
    expect(requests.some(request => request.method === 'DELETE')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(requests.some(request => request.method === 'DELETE')).toBe(true));
    expect(await screen.findByText('No files found')).toBeVisible();
    expect(await screen.findByText('Object deleted')).toBeVisible();
  });
});
