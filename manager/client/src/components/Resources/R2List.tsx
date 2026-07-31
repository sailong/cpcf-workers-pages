import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { R2Bucket } from '../../types';
import { ResourceService } from '../../services';
import R2Manager from './R2Manager';
import { ResourceInventoryList } from './ResourceInventoryList';

export default function R2List() {
    const { t } = useTranslation();
    const [managing, setManaging] = useState<R2Bucket | null>(null);
    return (
        <>
            <ResourceInventoryList
                kind="r2"
                title={t('resourceList.r2.title')}
                emptyLabel={t('resourceList.r2.noResources')}
                namePlaceholder={t('resourceList.r2.enterName')}
                icon={HardDrive}
                loadResources={ResourceService.getR2}
                createResource={ResourceService.createR2}
                deleteResource={ResourceService.deleteR2}
                onManage={setManaging}
            />
            {managing && <R2Manager bucket={managing} onClose={() => setManaging(null)} />}
        </>
    );
}
