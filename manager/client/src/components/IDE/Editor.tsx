import React from 'react';
import MonacoEditor from '@monaco-editor/react';

interface EditorProps {
    code: string;
    language: string;
    onChange: (value: string | undefined) => void;
    readOnly?: boolean;
}

const Editor: React.FC<EditorProps> = ({ code, language, onChange, readOnly = false }) => {
    return (
        <MonacoEditor
            height="100%"
            language={language}
            value={code}
            onChange={onChange}
            theme="vs-dark"
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
