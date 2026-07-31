import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../i18n';
import i18n from '../i18n';
import BuildForm from './build-form';

vi.mock('../utils/projectAnalyzer', () => ({
  analyzeFiles: vi.fn(),
  analyzeZip: vi.fn().mockResolvedValue(null)
}));

describe('BuildForm', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes selected project limits to the pre-creation upload and build', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      'data: {"type":"result","success":true,"buildId":"build-one"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
    ));
    const limits = {
      cpu: 1.5,
      memoryMb: 768,
      diskMb: 2048,
      uploadMb: 25,
      concurrentRequests: 40,
      buildTimeoutSeconds: 900,
      pids: 192
    };
    const { container } = render(
      <BuildForm setError={vi.fn()} showToast={vi.fn()} limits={limits} />
    );

    fireEvent.click(screen.getByRole('tab', { name: /ZIP/i }));
    const input = container.querySelector<HTMLInputElement>('#build-zip-upload');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [new File(['zip'], 'project.zip', { type: 'application/zip' })] }
    });
    fireEvent.click(await screen.findByRole('button', { name: /Start Build Process/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/build');
    expect(request?.headers).toEqual({ 'X-Project-Upload-Limit-Mb': '25' });
    const formData = request?.body as FormData;
    expect(JSON.parse(String(formData.get('limits')))).toEqual(limits);
  });
});
