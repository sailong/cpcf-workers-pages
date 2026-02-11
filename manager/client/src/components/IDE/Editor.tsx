import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useTheme } from '../../contexts/ThemeContext';

interface EditorProps {
    code: string;
    language: string;
    onChange: (value: string | undefined) => void;
    readOnly?: boolean;
    height?: string;
}

const Editor: React.FC<EditorProps> = ({ code, language, onChange, readOnly = false, height = "100%" }) => {
    const { theme } = useTheme();

    return (
        <MonacoEditor
            height={height}
            language={language}
            value={code}
            onChange={onChange}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={{
                minimap: { enabled: true },
                fontSize: 14,
                automaticLayout: true,
                readOnly: readOnly,
                scrollBeyondLastLine: false,
            }}
        />
    );
};

export default Editor;
