import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import { FeedbackProvider } from '../ui/FeedbackProvider';
import KVManager from './KVManager';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('KVManager', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  afterEach(() => vi.unstubAllGlobals());

  it('writes a key with parsed metadata and refreshes the key list', async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    let listCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      requests.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined });
      if (method === 'PUT') return json({ success: true });
      if (url.includes('/keys?')) {
        listCount += 1;
        return json({ keys: listCount === 1 ? [] : [{ name: 'greeting' }], list_complete: true });
      }
      return json({ error: 'Unexpected request' }, 500);
    }));

    render(<FeedbackProvider><KVManager namespace={{ id: 'kv-one', name: 'cache' }} onClose={vi.fn()} /></FeedbackProvider>);
    expect(await screen.findByText('No keys found')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Key Name'), { target: { value: 'greeting' } });
    fireEvent.change(screen.getByLabelText('Metadata (JSON)'), { target: { value: '{"scope":"test"}' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(requests.some(request => request.method === 'PUT')).toBe(true));
    const saved = requests.find(request => request.method === 'PUT');
    expect(saved?.url).toContain('/api/resources/kv/kv-one/values/greeting');
    expect(JSON.parse(saved?.body || '{}')).toEqual({ value: 'hello', metadata: { scope: 'test' } });
    expect(await screen.findByText('greeting')).toBeVisible();
    expect(await screen.findByText('Key saved')).toBeVisible();
  });
});
