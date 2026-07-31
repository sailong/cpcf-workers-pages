import { useState } from 'react';
import { Braces } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KVNamespace } from '../../types';
import { ResourceService } from '../../services';
import KVManager from './KVManager';
import { ResourceInventoryList } from './ResourceInventoryList';

export default function KVList() {
    const { t } = useTranslation();
    const [managing, setManaging] = useState<KVNamespace | null>(null);
    return (
        <>
            <ResourceInventoryList
                kind="kv"
                title={t('resourceList.kv.title')}
                emptyLabel={t('resourceList.kv.noResources')}
                namePlaceholder={t('resourceList.kv.enterName')}
                icon={Braces}
                loadResources={ResourceService.getKV}
                createResource={ResourceService.createKV}
                deleteResource={ResourceService.deleteKV}
                onManage={setManaging}
            />
            {managing && <KVManager namespace={managing} onClose={() => setManaging(null)} />}
        </>
    );
}
