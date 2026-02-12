import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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
                <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-lg">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">{this.props.t('error.systemError')}</h1>
                        <p className="text-gray-300 mb-4">{this.props.t('error.unexpectedError')}</p>
                        <div className="bg-gray-900 p-4 rounded text-xs font-mono text-red-300 overflow-auto max-h-48">
                            {this.state.error?.toString()}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold"
                        >
                            {this.props.t('error.reloadApp')}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default withTranslation()(ErrorBoundary);
