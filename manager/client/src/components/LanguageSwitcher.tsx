import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = "" }) => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh';
        i18n.changeLanguage(newLang);
    };

    return (
        <button
            onClick={toggleLanguage}
            className={`p-2 rounded-xl hover:bg-white/20 transition-all text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold ${className}`}
            title={i18n.language.startsWith('zh') ? "Switch to English" : "切换到中文"}
        >
            {i18n.language.startsWith('zh') ? '中' : 'EN'}
        </button>
    );
};

export default LanguageSwitcher;
