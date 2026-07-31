import { createContext, useContext } from 'react';

export type NoticeKind = 'success' | 'error' | 'info';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export interface FeedbackContextValue {
  notify: (message: string, kind?: NoticeKind) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const useFeedback = () => {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used within FeedbackProvider');
  return value;
};
