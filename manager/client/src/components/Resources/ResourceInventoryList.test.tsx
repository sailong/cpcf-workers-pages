import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Database } from 'lucide-react';
import '../../i18n';
import i18n from '../../i18n';
import { FeedbackProvider } from '../ui/FeedbackProvider';
import { ProjectService } from '../../services/projects';
import { ResourceInventoryList } from './ResourceInventoryList';

describe('ResourceInventoryList', () => {
    beforeAll(async () => { await i18n.changeLanguage('en'); });
    afterEach(() => vi.restoreAllMocks());

    it('shows binding capacity, searches bindings, and paginates resources', async () => {
        const resources = Array.from({ length: 12 }, (_, index) => ({
            id: `db-${String(index + 1).padStart(2, '0')}`,
            name: `database-${String(index + 1).padStart(2, '0')}`,
            created: '2026-07-30T00:00:00.000Z'
        }));
        vi.spyOn(ProjectService, 'getAll').mockResolvedValue([{
            id: 'project-one', name: 'billing-api', type: 'worker', status: 'running', port: 10001,
            mainFile: 'worker.js', activeReleaseId: null, envVars: {}, compatibilityDate: '2025-04-28',
            compatibilityFlags: [], limits: { cpu: 1, memoryMb: 128, diskMb: 256, uploadMb: 10, concurrentRequests: 10, buildTimeoutSeconds: 60, pids: 32 },
            createdAt: '2026-07-30T00:00:00.000Z',
            bindings: { kv: [], d1: [{ resourceId: 'db-11', varName: 'BILLING_DB' }], r2: [] }
        }]);

        render(
            <FeedbackProvider>
                <ResourceInventoryList
                    kind="d1"
                    title="D1 Database"
                    emptyLabel="No databases"
                    namePlaceholder="Database name"
                    icon={Database}
                    loadResources={async () => resources}
                    createResource={async () => {}}
                    deleteResource={async () => {}}
                    onManage={() => {}}
                />
            </FeedbackProvider>
        );

        expect(await screen.findByText('12')).toBeInTheDocument();
        expect(screen.getAllByText('1', { selector: 'strong' })).toHaveLength(2);
        expect(screen.getByPlaceholderText('Database name')).not.toHaveClass('hidden');
        expect(screen.queryByText('database-11')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Next page'));
        expect(await screen.findByText('database-11')).toBeInTheDocument();
        expect(screen.getByText('billing-api:BILLING_DB')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search resources, projects, or bindings'), { target: { value: 'BILLING_DB' } });
        await waitFor(() => expect(screen.getByText('database-11')).toBeInTheDocument());
        expect(screen.queryByText('database-12')).not.toBeInTheDocument();
    });
});
