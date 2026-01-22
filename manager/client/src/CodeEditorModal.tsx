import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface Binding {
    varName: string;
    resourceId: string;
}

interface EnvVar {
    type: 'plain' | 'json' | 'secret';
    value: string | object;
}

interface CodeEditorModalProps {
    project: { id: string; name: string; mainFile: string };
    onClose: () => void;
    onSaved: () => void;
}

type TabType = 'code' | 'bindings' | 'envvars' | 'settings';

const CodeEditorModal: React.FC<CodeEditorModalProps> = ({ project, onClose, onSaved }) => {
    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('code');

    // Code state
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');

    // Config state
    const [bindings, setBindings] = useState<{ kv: Binding[]; d1: Binding[] }>({ kv: [], d1: [] });
    const [envVars, setEnvVars] = useState<Record<string, EnvVar>>({});
    const [port, setPort] = useState<number>(0);

    // UI state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Available resources (for bindings)
    const [kvResources, setKvResources] = useState<any[]>([]);
    const [d1Resources, setD1Resources] = useState<any[]>([]);

    // Load full config
    useEffect(() => {
        loadFullConfig();
        loadResources();
    }, [project.id]);

    const loadFullConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/projects/${project.id}/full-config`);
            if (!res.ok) throw new Error('加载失败');

            const data = await res.json();
            setCode(data.code);
            setLanguage(data.language);
            setBindings(data.bindings || { kv: [], d1: [] });
            setEnvVars(data.envVarsRaw || {});
            setPort(data.port);
        } catch (err) {
            setError('加载配置失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadResources = async () => {
        try {
            const [kvRes, d1Res] = await Promise.all([
                fetch('/api/resources/kv'),
                fetch('/api/resources/d1')
            ]);
            setKvResources(await kvRes.json());
            setD1Resources(await d1Res.json());
        } catch (err) {
            console.error('Failed to load resources:', err);
        }
    };

    // Save code only
    const handleSaveCode = async () => {
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/projects/${project.id}/code`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '保存失败');
            }

            const data = await res.json();
            alert(data.restarted ? '代码已保存，Worker 已重启' : '代码已保存');
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
            alert('保存失败: ' + (err instanceof Error ? err.message : '未知错误'));
        } finally {
            setSaving(false);
        }
    };

    // Save config (bindings and envVars) 
    const handleSaveConfig = async () => {
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/projects/${project.id}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bindings, envVars, port })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '保存失败');
            }

            const data = await res.json();
            const message = data.restarted
                ? '配置已更新，Worker 已重启'
                : '配置已保存';
            alert(message);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
            alert('保存失败: ' + (err instanceof Error ? err.message : '未知错误'));
        } finally {
            setSaving(false);
        }
    };

    // File upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.js') && !file.name.endsWith('.ts')) {
            alert('只支持 .js 和 .ts 文件');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/projects/${project.id}/upload-replace`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('上传失败');

            const data = await res.json();
            alert(data.restarted ? '文件已替换，Worker 已重启' : '文件已替换');
            loadFullConfig();
            onSaved();
        } catch (err) {
            alert('上传失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }

        e.target.value = '';
    };

    // Bindings management
    const addKvBinding = () => {
        setBindings({
            ...bindings,
            kv: [...bindings.kv, { varName: '', resourceId: '' }]
        });
    };

    const removeKvBinding = (index: number) => {
        setBindings({
            ...bindings,
            kv: bindings.kv.filter((_, i) => i !== index)
        });
    };

    const updateKvBinding = (index: number, field: 'varName' | 'resourceId', value: string) => {
        const newKv = [...bindings.kv];
        newKv[index][field] = value;
        setBindings({ ...bindings, kv: newKv });
    };

    const addD1Binding = () => {
        setBindings({
            ...bindings,
            d1: [...bindings.d1, { varName: '', resourceId: '' }]
        });
    };

    const removeD1Binding = (index: number) => {
        setBindings({
            ...bindings,
            d1: bindings.d1.filter((_, i) => i !== index)
        });
    };

    const updateD1Binding = (index: number, field: 'varName' | 'resourceId', value: string) => {
        const newD1 = [...bindings.d1];
        newD1[index][field] = value;
        setBindings({ ...bindings, d1: newD1 });
    };

    // EnvVars management
    const addEnvVar = (key: string, type: 'plain' | 'json' | 'secret', value: string) => {
        if (!key) {
            alert('变量名不能为空');
            return;
        }

        let parsedValue: string | object = value;
        if (type === 'json') {
            try {
                parsedValue = JSON.parse(value);
            } catch (e) {
                alert('JSON 格式无效');
                return;
            }
        }

        setEnvVars({
            ...envVars,
            [key]: { type, value: parsedValue }
        });
    };

    const removeEnvVar = (key: string) => {
        const newEnvVars = { ...envVars };
        delete newEnvVars[key];
        setEnvVars(newEnvVars);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
                    <div>
                        <h2 className="text-xl font-bold text-white">编辑项目</h2>
                        <p className="text-gray-400 text-sm mt-1">{project.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-700 bg-gray-900">
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'code'
                            ? 'text-orange-400 border-b-2 border-orange-400 bg-gray-800'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        📝 代码
                    </button>
                    <button
                        onClick={() => setActiveTab('bindings')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'bindings'
                            ? 'text-orange-400 border-b-2 border-orange-400 bg-gray-800'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        🔗 绑定配置
                    </button>
                    <button
                        onClick={() => setActiveTab('envvars')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'envvars'
                            ? 'text-orange-400 border-b-2 border-orange-400 bg-gray-800'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        🔒 环境变量
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'settings'
                            ? 'text-orange-400 border-b-2 border-orange-400 bg-gray-800'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        ⚙️ 设置
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-500 text-white px-4 py-2 m-4 rounded flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-lg">加载中...</div>
                        </div>
                    ) : (
                        <>
                            {/* Code Tab */}
                            {activeTab === 'code' && (
                                <div className="h-full flex flex-col">
                                    <div className="flex gap-2 p-4 border-b border-gray-700 bg-gray-900">
                                        <button
                                            onClick={handleSaveCode}
                                            disabled={saving}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium disabled:bg-gray-600 transition-colors"
                                        >
                                            💾 {saving ? '保存中...' : '保存代码'}
                                        </button>

                                        <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium cursor-pointer transition-colors">
                                            📁 上传替换
                                            <input
                                                type="file"
                                                accept=".js,.ts"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                            />
                                        </label>

                                        <div className="flex-1"></div>

                                        <div className="text-gray-400 text-sm self-center">
                                            <span className="bg-gray-800 px-3 py-1 rounded font-mono mr-2">
                                                {project.mainFile}
                                            </span>
                                            <span className="bg-purple-900/50 px-3 py-1 rounded text-purple-300">
                                                {language === 'typescript' ? 'TypeScript' : 'JavaScript'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <Editor
                                            height="100%"
                                            language={language}
                                            value={code}
                                            onChange={(value) => setCode(value || '')}
                                            theme="vs-dark"
                                            options={{
                                                minimap: { enabled: true },
                                                fontSize: 14,
                                                lineNumbers: 'on',
                                                scrollBeyondLastLine: false,
                                                automaticLayout: true,
                                                tabSize: 2,
                                                insertSpaces: true,
                                                wordWrap: 'on',
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Bindings Tab */}
                            {activeTab === 'bindings' && (
                                <BindingsTab
                                    bindings={bindings}
                                    kvResources={kvResources}
                                    d1Resources={d1Resources}
                                    onAddKv={addKvBinding}
                                    onRemoveKv={removeKvBinding}
                                    onUpdateKv={updateKvBinding}
                                    onAddD1={addD1Binding}
                                    onRemoveD1={removeD1Binding}
                                    onUpdateD1={updateD1Binding}
                                    onSave={handleSaveConfig}
                                    saving={saving}
                                />
                            )}

                            {/* EnvVars Tab */}
                            {activeTab === 'envvars' && (
                                <EnvVarsTab
                                    envVars={envVars}
                                    onAdd={addEnvVar}
                                    onRemove={removeEnvVar}
                                    onSave={handleSaveConfig}
                                    saving={saving}
                                />
                            )}

                            {/* Settings Tab */}
                            {activeTab === 'settings' && (
                                <SettingsTab
                                    port={port}
                                    onChangePort={setPort}
                                    onSave={handleSaveConfig}
                                    saving={saving}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Bindings Tab Component
interface BindingsTabProps {
    bindings: { kv: Binding[]; d1: Binding[] };
    kvResources: any[];
    d1Resources: any[];
    onAddKv: () => void;
    onRemoveKv: (index: number) => void;
    onUpdateKv: (index: number, field: 'varName' | 'resourceId', value: string) => void;
    onAddD1: () => void;
    onRemoveD1: (index: number) => void;
    onUpdateD1: (index: number, field: 'varName' | 'resourceId', value: string) => void;
    onSave: () => void;
    saving: boolean;
}

const BindingsTab: React.FC<BindingsTabProps> = ({
    bindings,
    kvResources,
    d1Resources,
    onAddKv,
    onRemoveKv,
    onUpdateKv,
    onAddD1,
    onRemoveD1,
    onUpdateD1,
    onSave,
    saving
}) => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* KV Bindings */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">KV Namespace 绑定</h3>
                        <button
                            onClick={onAddKv}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                        >
                            + 添加 KV 绑定
                        </button>
                    </div>

                    {bindings.kv.length === 0 ? (
                        <div className="text-gray-500 text-center py-8 border border-gray-700 rounded">
                            暂无 KV 绑定
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {bindings.kv.map((binding, index) => (
                                <div key={index} className="flex gap-3 items-center bg-gray-900 p-3 rounded">
                                    <input
                                        type="text"
                                        placeholder="变量名 (如: MY_KV)"
                                        value={binding.varName}
                                        onChange={(e) => onUpdateKv(index, 'varName', e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                    />
                                    <select
                                        value={binding.resourceId}
                                        onChange={(e) => onUpdateKv(index, 'resourceId', e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">选择 KV Namespace</option>
                                        {kvResources.map(kv => (
                                            <option key={kv.id} value={kv.id}>{kv.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => onRemoveKv(index)}
                                        className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded"
                                    >
                                        删除
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* D1 Bindings */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">D1 Database 绑定</h3>
                        <button
                            onClick={onAddD1}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                        >
                            + 添加 D1 绑定
                        </button>
                    </div>

                    {bindings.d1.length === 0 ? (
                        <div className="text-gray-500 text-center py-8 border border-gray-700 rounded">
                            暂无 D1 绑定
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {bindings.d1.map((binding, index) => (
                                <div key={index} className="flex gap-3 items-center bg-gray-900 p-3 rounded">
                                    <input
                                        type="text"
                                        placeholder="变量名 (如: MY_DB)"
                                        value={binding.varName}
                                        onChange={(e) => onUpdateD1(index, 'varName', e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                    />
                                    <select
                                        value={binding.resourceId}
                                        onChange={(e) => onUpdateD1(index, 'resourceId', e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                    >
                                        <option value="">选择 D1 Database</option>
                                        {d1Resources.map(d1 => (
                                            <option key={d1.id} value={d1.id}>{d1.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => onRemoveD1(index)}
                                        className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded"
                                    >
                                        删除
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-gray-700">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold disabled:bg-gray-600 transition-colors"
                    >
                        {saving ? '保存中...' : '✅ 保存绑定配置并重启'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// EnvVars Tab Component  
interface EnvVarsTabProps {
    envVars: Record<string, EnvVar>;
    onAdd: (key: string, type: 'plain' | 'json' | 'secret', value: string) => void;
    onRemove: (key: string) => void;
    onSave: () => void;
    saving: boolean;
}

const EnvVarsTab: React.FC<EnvVarsTabProps> = ({ envVars, onAdd, onRemove, onSave, saving }) => {
    const [newKey, setNewKey] = useState('');
    const [newType, setNewType] = useState<'plain' | 'json' | 'secret'>('plain');
    const [newValue, setNewValue] = useState('');

    const handleAdd = () => {
        if (!newKey.trim()) {
            alert('变量名不能为空');
            return;
        }

        onAdd(newKey.trim(), newType, newValue);
        setNewKey('');
        setNewValue('');
        setNewType('plain');
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Add New EnvVar */}
                <div className="bg-gray-900 p-4 rounded border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-4">添加环境变量</h3>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">变量名</label>
                            <input
                                type="text"
                                placeholder="API_KEY"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">类型</label>
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as any)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            >
                                <option value="plain">明文 (Plain Text)</option>
                                <option value="json">JSON 对象</option>
                                <option value="secret">加密 (Secret)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">值</label>
                            {newType === 'json' ? (
                                <textarea
                                    placeholder='{"key": "value"}'
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                                    rows={4}
                                />
                            ) : (
                                <input
                                    type={newType === 'secret' ? 'password' : 'text'}
                                    placeholder={newType === 'secret' ? '将加密存储' : '变量值'}
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                />
                            )}
                        </div>

                        <button
                            onClick={handleAdd}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                        >
                            + 添加变量
                        </button>
                    </div>
                </div>

                {/* Existing EnvVars List */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4">已配置的环境变量</h3>

                    {Object.keys(envVars).length === 0 ? (
                        <div className="text-gray-500 text-center py-8 border border-gray-700 rounded">
                            暂无环境变量
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(envVars).map(([key, varData]) => (
                                <div key={key} className="bg-gray-900 p-4 rounded border border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-white font-bold">{key}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${varData.type === 'plain' ? 'bg-green-900 text-green-300' :
                                                varData.type === 'json' ? 'bg-blue-900 text-blue-300' :
                                                    'bg-purple-900 text-purple-300'
                                                }`}>
                                                {varData.type === 'plain' ? '明文' : varData.type === 'json' ? 'JSON' : '加密'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onRemove(key)}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm"
                                        >
                                            删除
                                        </button>
                                    </div>
                                    <div className="text-gray-400 font-mono text-sm bg-gray-800 p-2 rounded overflow-auto">
                                        {varData.type === 'json'
                                            ? JSON.stringify(varData.value, null, 2)
                                            : varData.type === 'secret'
                                                ? '******'
                                                : String(varData.value)
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-gray-700">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold disabled:bg-gray-600 transition-colors"
                    >
                        {saving ? '保存中...' : '✅ 保存环境变量并重启'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Settings Tab Component
interface SettingsTabProps {
    port: number;
    onChangePort: (port: number) => void;
    onSave: () => void;
    saving: boolean;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ port, onChangePort, onSave, saving }) => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-gray-900 p-6 rounded border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-4">项目设置</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">服务端口</label>
                            <input
                                type="number"
                                value={port}
                                onChange={(e) => onChangePort(parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                            <p className="text-gray-500 text-sm mt-2">
                                更改端口将导致服务重启。请确保新端口未被占用。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-gray-700">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold disabled:bg-gray-600 transition-colors"
                    >
                        {saving ? '保存中...' : '✅ 保存设置并重启'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CodeEditorModal;
