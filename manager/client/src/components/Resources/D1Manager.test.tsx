import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import { FeedbackProvider } from '../ui/FeedbackProvider';
import { D1Manager } from './D1Manager';

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('D1Manager', () => {
    beforeAll(async () => { await i18n.changeLanguage('en'); });
    afterEach(() => vi.unstubAllGlobals());

    it('loads migration status and applies selected SQL files after confirmation', async () => {
        const requests: Array<{ url: string; body?: string }> = [];
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
            if (url.endsWith('/tables')) return json([]);
            if (url.endsWith('/migrations')) return json({ table: 'd1_migrations', applied: [{ id: 1, name: '1_initial.sql', appliedAt: '2026-07-30T00:00:00.000Z' }] });
            if (url.endsWith('/migrations/apply')) return json({
                applied: ['2_add_index.sql'], skipped: [],
                migrations: [
                    { id: 1, name: '1_initial.sql', appliedAt: '2026-07-30T00:00:00.000Z' },
                    { id: 2, name: '2_add_index.sql', appliedAt: '2026-07-30T01:00:00.000Z' }
                ]
            });
            return json({ error: 'Unexpected request' }, 500);
        }));

        const { container } = render(<FeedbackProvider><D1Manager dbId="db-one" dbName="primary" onClose={() => {}} /></FeedbackProvider>);
        fireEvent.click(await screen.findByRole('button', { name: /Migrations/ }));
        expect(await screen.findByText('1_initial.sql')).toBeInTheDocument();

        const input = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
        const migration = new File(['CREATE INDEX idx_items ON items(id);'], '2_add_index.sql', { type: 'text/sql' });
        Object.defineProperty(migration, 'text', { value: async () => 'CREATE INDEX idx_items ON items(id);' });
        fireEvent.change(input, { target: { files: [migration] } });
        expect(await screen.findByText('2_add_index.sql')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
        await waitFor(() => expect(requests.some(request => request.url.endsWith('/migrations/apply'))).toBe(true));

        const applyRequest = requests.find(request => request.url.endsWith('/migrations/apply'));
        expect(JSON.parse(applyRequest?.body || '{}')).toEqual({
            migrations: [{ name: '2_add_index.sql', sql: 'CREATE INDEX idx_items ON items(id);' }]
        });
        expect(await screen.findByText('Applied 1 migrations')).toBeInTheDocument();
    });
});
