import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RotateCcw, TriangleAlert } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props & { t: TFunction }, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-base)] p-4">
                    <div className="console-panel w-full max-w-lg p-6">
                        <div className="mb-4 flex items-center gap-3 text-[var(--color-danger)]"><TriangleAlert size={22} aria-hidden="true" /><h1 className="text-lg font-semibold">{this.props.t('error.systemError')}</h1></div>
                        <p className="mb-4 text-sm text-[var(--text-muted)]">{this.props.t('error.unexpectedError')}</p>
                        <div className="max-h-48 overflow-auto rounded-md border border-red-500/25 bg-red-500/10 p-4 font-mono text-xs text-[var(--color-danger)]">
                            {this.state.error?.toString()}
                        </div>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="console-button primary mt-6"
                        >
                            <RotateCcw size={15} aria-hidden="true" />
                            {this.props.t('error.reloadApp')}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const TranslatedErrorBoundary = withTranslation()(ErrorBoundary);

export default TranslatedErrorBoundary;
