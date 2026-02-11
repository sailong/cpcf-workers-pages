import { useState, useEffect } from 'react'
import { D1Manager } from './D1Manager'
import KVManager from './KVManager'
import CodeEditorModal from './CodeEditorModal'
import CreateProjectPage from './create-project'
import R2Manager from './R2Manager'
import Login from './Login'
import ChangePasswordModal from './ChangePasswordModal'
import ErrorBoundary from './ErrorBoundary'
import { authenticatedFetch, getToken, setToken, removeToken } from './api'

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
    r2?: Array<{ varName: string; resourceId: string }>;
  };
  envVars?: Record<string, string>;
  portInUse?: boolean; // Added field
}

interface Resource {
  id: string;
  name: string;
  createdAt: string;
}

function App() {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kvResources, setKvResources] = useState<Resource[]>([]);
  const [d1Resources, setD1Resources] = useState<Resource[]>([]);
  const [r2Resources, setR2Resources] = useState<Resource[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'resources'>('list');

  // Modal State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [managingKV, setManagingKV] = useState<{ id: string; name: string } | null>(null);
  const [managingD1, setManagingD1] = useState<{ id: string; name: string } | null>(null);
  const [managingR2, setManagingR2] = useState<{ id: string; name: string } | null>(null);
  const [confirmingDeletion, setConfirmingDeletion] = useState<{ type: 'project' | 'kv' | 'd1' | 'r2'; id: string; name: string } | null>(null);

  // Form State
  const [newKvName, setNewKvName] = useState('');
  const [newD1Name, setNewD1Name] = useState('');
  const [newR2Name, setNewR2Name] = useState('');

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Server Health State
  const [serverOnline, setServerOnline] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Health Check Effect (always runs)
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setServerOnline(res.ok);
      } catch {
        setServerOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auth and data fetching Effect (only when logged in)
  useEffect(() => {
    if (!token) return;
    fetchProjects();
    fetchResources();
    const interval = setInterval(fetchProjects, 5000); // Polling status

    // Auth expiry listener
    const handleExpired = () => {
      showToast("登录已过期，请重新登录", 'error');
      // Small delay to let toast show
      setTimeout(() => {
        setTokenState(null);
      }, 1500);
    };
    window.addEventListener('auth:expired', handleExpired);

    return () => {
      clearInterval(interval);
      window.removeEventListener('auth:expired', handleExpired);
    };
  }, [token]);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    setTokenState(newToken);
  };

  const handleLogout = () => {
    removeToken();
    setTokenState(null);
  };

  // Early return AFTER all Hooks
  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const fetchProjects = async () => {
    try {
      const res = await authenticatedFetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error("Failed to fetch projects");
    }
  };

  const fetchResources = async () => {
    try {
      const [kvRes, d1Res, r2Res] = await Promise.all([
        authenticatedFetch('/api/resources/kv'),
        authenticatedFetch('/api/resources/d1'),
        authenticatedFetch('/api/resources/r2')
      ]);
      setKvResources(await kvRes.json());
      setD1Resources(await d1Res.json());
      setR2Resources(await r2Res.json());
    } catch (e) {
      console.error("Failed to fetch resources");
      showToast("获取资源列表失败", 'error');
    }
  };

  const handleCreateKv = async () => {
    if (!newKvName) return showToast("请输入 KV Namespace 名称", 'error');
    if (!newKvName) return showToast("请输入 KV Namespace 名称", 'error');
    try {
      const res = await authenticatedFetch('/api/resources/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKvName })
      });
      if (res.ok) {
        setNewKvName('');
        fetchResources();
        showToast("KV Namespace 创建成功");
      } else {
        const err = await res.json();
        showToast(err.error || "创建失败", 'error');
      }
    } catch (e) {
      showToast("创建失败", 'error');
    }
  };

  const handleCreateD1 = async () => {
    if (!newD1Name) return showToast("请输入 D1 Database 名称", 'error');
    try {
      const res = await authenticatedFetch('/api/resources/d1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newD1Name })
      });
      if (res.ok) {
        setNewD1Name('');
        fetchResources();
        showToast("D1 Database 创建成功");
      } else {
        const err = await res.json();
        showToast(err.error || "创建失败", 'error');
      }
    } catch (e) {
      showToast("创建失败", 'error');
    }
  };

  const handleCreateR2 = async () => {
    if (!newR2Name) return showToast("请输入 R2 Bucket 名称", 'error');

    // R2 Naming Validation
    if (newR2Name.length < 3 || newR2Name.length > 63) {
      return showToast("名称长度必须在 3-63 个字符之间", 'error');
    }
    // Regex: Start/End with Alphanumeric, only lowercase/numbers/hyphens allowed
    const r2Regex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    if (!r2Regex.test(newR2Name)) {
      return showToast("名称非法：只能包含小写字母/数字/-，且首尾必须是字母或数字", 'error');
    }

    try {
      const res = await authenticatedFetch('/api/resources/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newR2Name })
      });
      if (res.ok) {
        setNewR2Name('');
        fetchResources();
        showToast("R2 Bucket 创建成功");
      } else {
        const err = await res.json();
        showToast(err.error || "创建失败", 'error');
      }
    } catch (e) {
      showToast("创建失败", 'error');
    }
  };



  const toggleProject = async (id: string, currentStatus: string) => {
    const action = currentStatus === 'running' ? 'stop' : 'start';

    // Helper to perform the fetch
    const doRemoteCall = async (force = false) => {
      try {
        const res = await authenticatedFetch(`/api/projects/${id}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force })
        });

        if (res.status === 409 && action === 'start') {
          const data = await res.json();
          if (confirm(`端口 ${data.error?.match(/\d+/)?.[0] || 'Unknown'} 已被占用 (${data.owner})\n\n是否强制启动？\n这将会终止占用该端口的进程。`)) {
            await doRemoteCall(true); // Retry with force
            return;
          } else {
            return; // Cancelled
          }
        }

        if (!res.ok) throw new Error((await res.json()).error || 'Unknown error');
        fetchProjects();
        showToast(`项目已${action === 'start' ? '启动' : '停止'}`);
      } catch (e) {
        showToast(`操作失败: ${e instanceof Error ? e.message : '未知错误'}`, 'error');
      }
    };

    await doRemoteCall();
  };

  // Initiate Deletion
  const handleDeleteClick = (type: 'project' | 'kv' | 'd1' | 'r2', id: string, name: string) => {
    setConfirmingDeletion({ type, id, name });
  };

  // Execute Deletion
  const executeDelete = async () => {
    if (!confirmingDeletion) return;
    const { type, id } = confirmingDeletion;

    try {
      let url = '';
      if (type === 'project') url = `/api/projects/${id}`;
      else if (type === 'kv') url = `/api/resources/kv/${id}`;
      else if (type === 'd1') url = `/api/resources/d1/${id}`;
      else if (type === 'r2') url = `/api/resources/r2/${id}`;

      const res = await authenticatedFetch(url, { method: 'DELETE' });

      if (res.ok) {
        if (type === 'project') fetchProjects();
        else fetchResources();
        showToast("删除成功");
      } else {
        throw new Error();
      }
    } catch (e) {
      showToast('删除失败', 'error');
    } finally {
      setConfirmingDeletion(null);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-950 text-gray-100 font-sans relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[60] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${toast.type === 'success' ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'
          }`}>
          <span className="text-xl">{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Confirm Deletion Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowChangePassword(false);
            showToast("密码修改成功，请重新登录");
            handleLogout();
          }}
        />
      )}
      {confirmingDeletion && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] backdrop-blur-sm transition-all">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-md transform scale-100 transition-transform">
            <h3 className="text-xl font-bold text-white mb-2">确认删除</h3>
            <p className="text-gray-300 mb-6">
              确定要删除 <span className="font-bold text-white">{confirmingDeletion.name}</span> 吗？
              {confirmingDeletion.type === 'project' && " 正在运行的项目将被停止。"}
              {confirmingDeletion.type !== 'project' && " 此操作不可恢复，数据将永久丢失。"}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmingDeletion(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20"
              >
                🗑️ 确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-yellow-500">
              CCFWP 管理平台
            </h1>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${serverOnline ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-red-900/30 border-red-800 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {serverOnline ? '服务在线' : '连接中断'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                仪表盘
              </button>
              <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                新建项目
              </button>
              <button onClick={() => setActiveTab('resources')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'resources' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                资源管理
              </button>
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-gray-800">
              <button onClick={() => setShowChangePassword(true)} className="text-gray-400 hover:text-white text-sm px-2">
                🔑 改密
              </button>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-sm px-2">
                退出
              </button>
            </div>
          </div>
        </header>

        {activeTab === 'resources' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* KV Namespaces */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="bg-blue-500/10 text-blue-500 p-2 rounded-lg mr-3">📦</span>
                KV 键值存储
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  value={newKvName}
                  onChange={e => setNewKvName(e.target.value)}
                  placeholder="MY_CACHE"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                />
                <button onClick={handleCreateKv} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium">
                  创建
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {kvResources.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">暂无 KV 命名空间</div>
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
                          onClick={() => handleDeleteClick('kv', kv.id, kv.name)}
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
                D1 数据库
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  value={newD1Name}
                  onChange={e => setNewD1Name(e.target.value)}
                  placeholder="users_db"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                />
                <button onClick={handleCreateD1} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-medium">
                  创建
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {d1Resources.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">暂无 D1 数据库</div>
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
                          onClick={() => handleDeleteClick('d1', db.id, db.name)}
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
            {/* R2 Buckets */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="bg-yellow-500/10 text-yellow-500 p-2 rounded-lg mr-3">🪣</span>
                R2 对象存储
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  value={newR2Name}
                  onChange={e => setNewR2Name(e.target.value)}
                  placeholder="MY_BUCKET"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                />
                <button onClick={handleCreateR2} className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded-lg text-sm font-medium">
                  创建
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {r2Resources.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">暂无 R2 存储桶</div>
                ) : r2Resources.map(bucket => (
                  <div key={bucket.id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{bucket.name}</div>
                        <div className="text-xs text-gray-600 font-mono mt-1">ID: {bucket.id}</div>
                      </div>
                      <div className="flex gap-2">
                        {/* R2 specific management */}
                        <button
                          onClick={() => setManagingR2({ id: bucket.id, name: bucket.name })}
                          className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs px-3 py-1.5 rounded transition-all font-medium"
                        >
                          管理
                        </button>
                        <button
                          onClick={() => handleDeleteClick('r2', bucket.id, bucket.name)}
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
                创建新项目
              </h2>
              <p className="text-gray-500 text-sm mt-1">支持在线编写 Worker 或上传 Pages 静态文件</p>
            </div>
            <CreateProjectPage onSuccess={() => {
              fetchProjects();
              setActiveTab('list');
            }} />
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
                      <span>端口: <span className="text-gray-300 font-mono">{p.port}</span>
                        <span className="text-xs text-gray-500 ml-1">(内部)</span>
                        {p.status === 'stopped' && p.portInUse && (
                          <span className="ml-2 text-red-400 text-xs font-bold animate-pulse" title="此端口已被系统或其他程序占用">
                            ⚠️ 端口被占用
                          </span>
                        )}
                      </span>
                      {p.bindings?.kv && p.bindings.kv.length > 0 && <span className="text-blue-400">{p.bindings.kv.length} KV</span>}
                      {p.bindings?.d1 && p.bindings.d1.length > 0 && <span className="text-purple-400">{p.bindings.d1.length} D1</span>}
                      {p.bindings?.r2 && p.bindings.r2.length > 0 && <span className="text-yellow-400">{p.bindings.r2.length} R2</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {p.status === 'running' && (
                    <a
                      href={`${window.location.protocol}//${p.name.toLowerCase()}-${p.type}.${window.location.hostname}:${window.location.port}`}
                      target="_blank"
                      className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-4"
                    >
                      打开应用 ↗
                    </a>
                  )}

                  <button
                    onClick={() => toggleProject(p.id, p.status)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${p.status === 'running'
                      ? 'bg-gray-800 text-red-400 hover:bg-gray-700 hover:text-red-300'
                      : 'bg-green-600 text-white hover:bg-green-500'
                      }`}
                  >
                    {p.status === 'running' ? '停止' : '启动'}
                  </button>

                  <button
                    onClick={() => setEditingProject(p)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    ✏️ 编辑
                  </button>

                  <button
                    onClick={() => handleDeleteClick('project', p.id, p.name)}
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

      {/* R2 Manager Modal */}
      {managingR2 && (
        <R2Manager
          bucket={managingR2}
          onClose={() => setManagingR2(null)}
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
            showToast("配置已保存");
          }}
        />
      )}
    </div>
  )
}

export default App