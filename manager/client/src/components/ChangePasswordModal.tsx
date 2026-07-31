import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';
import { Loader2 } from 'lucide-react';

interface ChangePasswordModalProps {
    onClose: () => void;
    onSuccess: () => void;
    required?: boolean;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSuccess, required = false }) => {
    const { t } = useTranslation();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (required) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, required]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            return setError(t('auth.passwordMismatch'));
        }
        if (newPassword.length < 8) {
            return setError(t('auth.passwordLength'));
        }

        setLoading(true);
        try {
            await AuthService.changePassword(oldPassword, newPassword);
            onSuccess();
        } catch (error: unknown) {
            const message = axios.isAxiosError<{ error?: string }>(error)
                ? error.response?.data?.error || error.message
                : error instanceof Error ? error.message : '';
            setError(message || t('auth.changePasswordFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" onMouseDown={() => { if (!required) onClose(); }}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="change-password-title"
                className="console-dialog w-full max-w-md"
                onMouseDown={event => event.stopPropagation()}
            >
                <div className="border-b border-[var(--border-color)] px-5 py-4">
                    <h2 id="change-password-title" className="text-base font-semibold text-[var(--text-main)]">{t('auth.changePasswordTitle')}</h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 px-5 py-5">
                    <div>
                        <label htmlFor="old-password" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('auth.oldPassword')}</label>
                        <input
                            id="old-password"
                            type="password"
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                            className="console-input w-full"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('auth.newPassword')}</label>
                        <input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="console-input w-full"
                        />
                    </div>
                    <div>
                        <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{t('auth.confirmPassword')}</label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="console-input w-full"
                        />
                    </div>

                    {error && (
                        <div role="alert" className="console-alert error mb-0">
                            {error}
                        </div>
                    )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-[var(--border-color)] bg-[var(--bg-subtle)] px-5 py-3">
                        {!required && (
                            <button type="button" onClick={onClose} className="console-button secondary">
                                {t('common.cancel')}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="console-button primary"
                        >
                            {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                            {loading ? t('common.saving') : t('auth.changePasswordButton')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
