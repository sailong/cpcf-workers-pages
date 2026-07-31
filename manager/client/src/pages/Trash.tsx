import { useTranslation } from 'react-i18next';
import TrashList from '../components/Resources/TrashList';

const Trash = () => {
    const { t } = useTranslation();
    return (
        <div className="console-page">
            <section className="console-page-header">
                <div><h1>{t('trash.title')}</h1><p>{t('trash.subtitle')}</p></div>
            </section>
            <TrashList />
        </div>
    );
};

export default Trash;
