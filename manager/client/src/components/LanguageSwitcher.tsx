import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
    const { t, i18n } = useTranslation();
    const chinese = i18n.language.startsWith('zh');
    const label = chinese ? t('theme.switchToEn') : t('theme.switchToZh');

    return (
        <button
            type="button"
            onClick={() => void i18n.changeLanguage(chinese ? 'en' : 'zh')}
            className={`console-button secondary ${className}`}
            title={label}
            aria-label={label}
        >
            <Languages size={15} aria-hidden="true" />
            <span>{chinese ? '中文' : 'EN'}</span>
        </button>
    );
};

export default LanguageSwitcher;
