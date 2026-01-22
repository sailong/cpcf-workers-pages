import { useState, useEffect } from 'react'
import { D1Manager } from './D1Manager'
import KVManager from './KVManager'
import CodeEditorModal from './CodeEditorModal'
import CreateWorkerForm from './CreateWorkerForm'

interface Project {
  id: string;
  name: string;
  type: 'worker' | 'pages';
  port: number;
  status: 'stopped' | 'running' | 'error';
  mainFile: string;
  bindings: {
    kv?: Array<{ varName: string; resourceId: string }>;
    d1?: Array<{ varName: string; resourceId: string }>;
  };
  envVars?: Record<string, string>;
}

interface Resource {
  id: string;
  name: string;
  createdAt: string;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [kvResources, setKvResources] = useState<Resource[]>([]);
  const [d1Resources, setD1Resources] = useState<Resource[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'resources'>('list');

  // Form State
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Bindings State resourceId: string }>>([]); resourceId: string }>>([]);

  // Resource Creation
  const [newKvName, setNewKvName] = useState('');
  const [newD1Name, setNewD1Name] = useState('');

  // D1 Manager
  const [managingD1, setManagingD1] = useState<{ id: string; name: string } | null>(null);

  // KV Manager
  const [managingKV, setManagingKV] = useState<{ id: string; name: string } | null>(null);

  // Custom Port
  const [customPort, setCustomPort] = useState<number | ''>('');

  // Code Editor
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchResources();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error("Failed to fetch projects");
    }
  };

  const fetchResources = async () => {
    try {
      const [kvRes, d1Res] = await Promise.all([
        fetch('/api/resources/kv'),
        fetch('/api/resources/d1')
      ]);
      setKvResources(await kvRes.json());
      setD1Resources(await d1Res.json());
    } catch (e) {
      console.error("Failed to fetch resources");
    }
  };

  const handleCreateKv = async () => {
    if (!newKvName) return alert("请输入 KV Namespace 名称");
    try {
      const res = await fetch('/api/resources/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKvName })
      });
      if (res.ok) {
        setNewKvName('');
        fetchResources();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      alert("创建失败");
    }
  };

  const handleCreateD1 = async () => {
    if (!newD1Name) return alert("请输入 D1 Database 名称");
    try {
      const res = await fetch('/api/resources/d1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newD1Name })
      });
      if (res.ok) {
        setNewD1Name('');
        fetchResources();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      alert("创建失败");
    }
  };



  const toggleProject = async (id: string, currentStatus: string) => {
    const action = currentStatus === 'running' ? 'stop' : 'start';
    await fetch(`/api/projects/${id}/${action}`, { method: 'POST' });
    fetchProjects();
  };

  const deleteProject = async (id: string, name: string) => {
    if (!confirm(`确定要删除项目 "${name}" 吗？正在运行的项目将被停止。`)) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProjects();
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  const deleteKVNamespace = async (id: string, name: string) => {
    if (!confirm(`确定要删除 KV Namespace "${name}" 吗？所有数据将被删除。`)) return;
    try {
      const res = await fetch(`/api/resources/kv/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchResources();
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  const deleteD1Database = async (id: string, name: string) => {
    if (!confirm(`确定要删除 D1 Database "${name}" 吗？数据库文件将被永久删除。`)) return;
    try {
      const res = await fetch(`/api/resources/d1/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchResources();
      }
    } catch (e) {
      alert('删除失败');
    }

  };
  return (
    <div className="min-h-screen p-8 bg-gray-950 text-gray-100 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-yellow-500">
              Cloudflare Platform
            </h1>
            <p className="text-gray-500 text-sm mt-1">本地容器化管理平台 · 参照真实工作流</p>
          </div>
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              New Project
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'resources' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              Resources
            </button>
          </div>
        </header>

        {activeTab === 'resources' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* KV Namespaces */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="bg-blue-500/10 text-blue-500 p-2 rounded-lg mr-3">📦</span>
                KV Namespaces
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  value={newKvName}
                  onChange={e => setNewKvName(e.target.value)}
                  placeholder="MY_CACHE"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                />
                <button onClick={handleCreateKv} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium">
                  Create
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {kvResources.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">暂无 KV Namespace</div>
                ) : kvResources.map(kv => (
                  <div key={kv.id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{kv.name}</div>
                        <div className="text-xs text-gray-600 font-mono mt-1">ID: {kv.id}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setManagingKV({ id: kv.id, name: kv.name })}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded transition-all"
                        >
                          管理
                        </button>
                        <button
                          onClick={() => deleteKVNamespace(kv.id, kv.name)}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded transition-all"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* D1 Databases */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="bg-purple-500/10 text-purple-500 p-2 rounded-lg mr-3">🗄️</span>
                D1 Databases
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  value={newD1Name}
                  onChange={e => setNewD1Name(e.target.value)}
                  placeholder="users_db"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                />
                <button onClick={handleCreateD1} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-medium">
                  Create
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {d1Resources.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">暂无 D1 Database</div>
                ) : d1Resources.map(db => (
                  <div key={db.id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{db.name}</div>
                        <div className="text-xs text-gray-600 font-mono mt-1">ID: {db.id}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setManagingD1({ id: db.id, name: db.name })}
                          className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1.5 rounded transition-all"
                        >
                          管理
                        </button>
                        <button
                          onClick={() => deleteD1Database(db.id, db.name)}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded transition-all"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl">
            <div className="border-b border-gray-800 p-4">
              <h2 className="text-xl font-semibold flex items-center">
                <span className="bg-orange-500/10 text-orange-500 p-2 rounded-lg mr-3">🚀</span>
                创建新 Worker
              </h2>
              <p className="text-gray-500 text-sm mt-1">支持在线编写或上传文件</p>
            </div>
            <CreateWorkerForm onSuccess={fetchProjects} />
          </div>
        )}

        {activeTab === 'list' && (
          <div className="grid gap-6">
            {projects.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-gray-900/50 rounded-xl border border-dashed border-gray-800">
                暂无项目。先创建资源，再部署项目！
              </div>
            ) : projects.map(p => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center justify-between hover:border-gray-700 transition-all shadow-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${p.status === 'running' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                  <div>
                    <h3 className="text-lg font-bold text-gray-200">{p.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="uppercase text-xs font-bold px-2 py-0.5 rounded bg-gray-800 border border-gray-700">{p.type}</span>
                      <span>Port: <span className="text-gray-300 font-mono">{p.port}</span></span>
                      {p.bindings?.kv && p.bindings.kv.length > 0 && <span className="text-blue-400">{p.bindings.kv.length} KV</span>}
                      {p.bindings?.d1 && p.bindings.d1.length > 0 && <span className="text-purple-400">{p.bindings.d1.length} D1</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {p.status === 'running' && (
                    <a
                      href={`http://${window.location.hostname}:${p.port}`}
                      target="_blank"
                      className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-4"
                    >
                      Open App ↗
                    </a>
                  )}

                  <button
                    onClick={() => toggleProject(p.id, p.status)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${p.status === 'running'
                      ? 'bg-gray-800 text-red-400 hover:bg-gray-700 hover:text-red-300'
                      : 'bg-green-600 text-white hover:bg-green-500'
                      }`}
                  >
                    {p.status === 'running' ? 'Stop' : 'Start'}
                  </button>

                  <button
                    onClick={() => setEditingProject(p)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    ✏️ 编辑
                  </button>

                  <button
                    onClick={() => deleteProject(p.id, p.name)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* D1 Manager Modal */}
      {managingD1 && (
        <D1Manager
          dbId={managingD1.id}
          dbName={managingD1.name}
          onClose={() => setManagingD1(null)}
        />
      )}

      {/* KV Manager Modal */}
      {managingKV && (
        <KVManager
          namespace={managingKV}
          onClose={() => setManagingKV(null)}
        />
      )}

      {/* Code Editor Modal */}
      {editingProject && (
        <CodeEditorModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={() => {
            setEditingProject(null);
            fetchProjects();
          }}
        />
      )}
    </div>
  )
}

export default App