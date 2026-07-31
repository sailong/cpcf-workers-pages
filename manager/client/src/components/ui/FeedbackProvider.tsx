import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FeedbackContext, type ConfirmOptions, type NoticeKind } from '../../contexts/feedback-context';

interface Notice {
  id: number;
  kind: NoticeKind;
  message: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void;
}

export const FeedbackProvider = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const nextId = useRef(0);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const notify = useCallback((message: string, kind: NoticeKind = 'info') => {
    const id = ++nextId.current;
    setNotices(current => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setNotices(current => current.filter(notice => notice.id !== id));
    }, 5000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    setPendingConfirm({ ...options, resolve });
  }), []);

  const closeConfirm = useCallback((result: boolean) => {
    setPendingConfirm(current => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pendingConfirm) return;
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeConfirm, pendingConfirm]);

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}

      <div className="fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {notices.map(notice => {
          const Icon = notice.kind === 'success' ? CheckCircle2 : notice.kind === 'error' ? AlertCircle : Info;
          return (
            <div key={notice.id} className={`console-toast console-toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
              <Icon size={17} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm leading-5">{notice.message}</span>
              <button
                type="button"
                className="icon-button h-7 w-7 shrink-0"
                onClick={() => setNotices(current => current.filter(item => item.id !== notice.id))}
                aria-label={t('common.close')}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {pendingConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4" onMouseDown={() => closeConfirm(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="console-dialog w-full max-w-md"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="border-b border-[var(--border-color)] px-5 py-4">
              <h2 id="confirm-dialog-title" className="text-base font-semibold text-[var(--text-main)]">
                {pendingConfirm.title || t('common.confirm')}
              </h2>
            </div>
            <p id="confirm-dialog-message" className="whitespace-pre-line px-5 py-5 text-sm leading-6 text-[var(--text-muted)]">
              {pendingConfirm.message}
            </p>
            <div className="flex justify-end gap-2 border-t border-[var(--border-color)] bg-[var(--bg-subtle)] px-5 py-3">
              <button type="button" className="console-button secondary" onClick={() => closeConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={`console-button ${pendingConfirm.destructive ? 'danger' : 'primary'}`}
                onClick={() => closeConfirm(true)}
              >
                {pendingConfirm.confirmLabel || t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};
