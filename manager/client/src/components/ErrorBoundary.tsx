import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
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
                        <h1 className="text-2xl font-bold text-red-500 mb-4">系统发生错误</h1>
                        <p className="text-gray-300 mb-4">程序遇到了未预期的错误。</p>
                        <div className="bg-gray-900 p-4 rounded text-xs font-mono text-red-300 overflow-auto max-h-48">
                            {this.state.error?.toString()}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold"
                        >
                            重新加载应用
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
