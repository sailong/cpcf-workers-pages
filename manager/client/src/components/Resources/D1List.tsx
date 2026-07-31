import { useState } from 'react';
import { Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { D1Database } from '../../types';
import { ResourceService } from '../../services';
import D1Manager from './D1Manager';
import { ResourceInventoryList } from './ResourceInventoryList';

export default function D1List() {
    const { t } = useTranslation();
    const [managing, setManaging] = useState<D1Database | null>(null);
    return (
        <>
            <ResourceInventoryList
                kind="d1"
                title={t('resourceList.d1.title')}
                emptyLabel={t('resourceList.d1.noResources')}
                namePlaceholder={t('resourceList.d1.enterName')}
                icon={Database}
                loadResources={ResourceService.getD1}
                createResource={ResourceService.createD1}
                deleteResource={ResourceService.deleteD1}
                onManage={setManaging}
            />
            {managing && <D1Manager dbId={managing.id} dbName={managing.name} onClose={() => setManaging(null)} />}
        </>
    );
}
