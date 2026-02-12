import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="flex space-x-2">
            <button
                onClick={() => changeLanguage('en')}
                className={`px-3 py-1 rounded transition-colors ${i18n.language.startsWith('en')
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
            >
                English
            </button>
            <button
                onClick={() => changeLanguage('zh')}
                className={`px-3 py-1 rounded transition-colors ${i18n.language.startsWith('zh')
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
            >
                中文
            </button>
        </div>
    );
};

export default LanguageSwitcher;
