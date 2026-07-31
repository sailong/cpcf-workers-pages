import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/useTheme';

interface ThemeToggleProps {
    className?: string;
}

const ThemeToggle = ({ className = '' }: ThemeToggleProps) => {
    const { theme, toggleTheme } = useTheme();
    const { t } = useTranslation();
    const label = theme === 'dark' ? t('theme.light') : t('theme.dark');

    return (
        <button type="button" onClick={toggleTheme} className={`icon-button ${className}`} title={label} aria-label={label}>
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
    );
};

export default ThemeToggle;
