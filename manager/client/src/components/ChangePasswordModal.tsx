import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';

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
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[70] backdrop-blur-sm">
            <div className="neo-glass p-6 rounded-xl shadow-2xl w-full max-w-md mx-4">
                <h3 className="text-xl font-bold text-[var(--text-main)] mb-4">{t('auth.changePasswordTitle')}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[var(--text-muted)] text-sm mb-1">{t('auth.oldPassword')}</label>
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                            className="neo-input w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-[var(--text-muted)] text-sm mb-1">{t('auth.newPassword')}</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="neo-input w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-[var(--text-muted)] text-sm mb-1">{t('auth.confirmPassword')}</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="neo-input w-full"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm text-center font-medium backdrop-blur-md">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-6">
                        {!required && (
                            <button type="button" onClick={onClose} className="btn-glass">
                                {t('common.cancel')}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? t('common.saving') : t('auth.changePasswordButton')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
