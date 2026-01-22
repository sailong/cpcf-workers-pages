export const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare Docker Demo</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: '#F38020', // Cloudflare Orange
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-900 text-white min-h-screen font-sans">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <header class="mb-10 text-center">
            <h1 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-yellow-500 mb-2">
                Cloudflare Docker Demo
            </h1>
            <p class="text-gray-400">Local Development Environment for Workers, D1 & KV</p>
        </header>

        <div class="grid md:grid-cols-2 gap-8">
            <!-- KV Section -->
            <section class="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                <div class="flex items-center mb-4">
                    <div class="p-2 bg-blue-500/20 rounded-lg mr-3 text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                    </div>
                    <h2 class="text-xl font-semibold">Workers KV</h2>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Key</label>
                        <input type="text" id="kv-key" placeholder="e.g., config_setting" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand focus:outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Value</label>
                        <input type="text" id="kv-value" placeholder="e.g., enabled" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand focus:outline-none transition-all">
                    </div>
                    
                    <div class="flex gap-2 pt-2">
                        <button onclick="setKV()" class="flex-1 bg-brand hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                            Set Value
                        </button>
                        <button onclick="getKV()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors border border-gray-600">
                            Get Value
                        </button>
                    </div>

                    <div class="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700 min-h-[60px]">
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Result</div>
                        <div id="kv-result" class="font-mono text-green-400 text-sm break-all"></div>
                    </div>
                </div>
            </section>

            <!-- D1 Section -->
            <section class="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                <div class="flex items-center mb-4">
                    <div class="p-2 bg-purple-500/20 rounded-lg mr-3 text-purple-400">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                    </div>
                    <h2 class="text-xl font-semibold">D1 Database (SQLite)</h2>
                </div>

                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Name</label>
                            <input type="text" id="db-name" placeholder="John Doe" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Email</label>
                            <input type="email" id="db-email" placeholder="john@example.com" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all">
                        </div>
                    </div>
                    
                    <div class="flex gap-2 pt-2">
                        <button onclick="addUser()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                            Add User
                        </button>
                        <button onclick="fetchUsers()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors border border-gray-600">
                            Refresh List
                        </button>
                    </div>

                    <div class="mt-4">
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">User List</div>
                        <div class="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                            <ul id="db-list" class="divide-y divide-gray-800 max-h-[200px] overflow-y-auto">
                                <li class="p-3 text-center text-gray-500 text-sm">Loading...</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </div>
        
        <footer class="mt-12 text-center text-gray-600 text-sm">
            <p>Running in Docker • emulate Cloudflare Workers Environment</p>
        </footer>
    </div>

    <script>
        // KV Functions
        async function getKV() {
            const key = document.getElementById('kv-key').value;
            if (!key) return showToast('Please enter a key', 'error');
            
            try {
                const res = await fetch(\`/api/kv?key=\${key}\`);
                const data = await res.json();
                document.getElementById('kv-result').innerText = data.value !== null ? data.value : '(null)';
            } catch (e) {
                document.getElementById('kv-result').innerText = 'Error fetching KV';
            }
        }

        async function setKV() {
            const key = document.getElementById('kv-key').value;
            const value = document.getElementById('kv-value').value;
            if (!key || !value) return showToast('Please enter key and value', 'error');

            try {
                await fetch('/api/kv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value })
                });
                document.getElementById('kv-result').innerText = 'Valid saved!';
                showToast('Value saved successfully');
            } catch (e) {
                showToast('Error saving value', 'error');
            }
        }

        // D1 Functions
        async function fetchUsers() {
            const list = document.getElementById('db-list');
            try {
                const res = await fetch('/api/db');
                const users = await res.json();
                
                list.innerHTML = users.length ? users.map(u => \`
                    <li class="p-3 hover:bg-gray-800/50 transition-colors flex justify-between items-center group">
                        <div>
                            <div class="font-medium text-gray-200">\${u.name}</div>
                            <div class="text-xs text-gray-500">\${u.email}</div>
                        </div>
                        <div class="text-xs text-gray-600 font-mono">ID: \${u.id}</div>
                    </li>
                \`).join('') : '<li class="p-3 text-center text-gray-500 text-sm">No users found</li>';
            } catch (e) {
                list.innerHTML = '<li class="p-3 text-center text-red-400 text-sm">Error loading users</li>';
            }
        }

        async function addUser() {
            const name = document.getElementById('db-name').value;
            const email = document.getElementById('db-email').value;
            
            if (!name || !email) return showToast('Please fill all fields', 'error');

            try {
                const res = await fetch('/api/db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email })
                });
                
                if (res.ok) {
                    document.getElementById('db-name').value = '';
                    document.getElementById('db-email').value = '';
                    fetchUsers();
                    showToast('User added successfully');
                } else {
                    const err = await res.text();
                    showToast(err, 'error');
                }
            } catch (e) {
                showToast('Error adding user', 'error');
            }
        }

        // Utils
        function showToast(msg, type = 'success') {
            // Simple alert for now, can be upgraded to custom toast
            // console.log(type.toUpperCase() + ": " + msg);
            // Using a temporary visual indicator could be nice but alert is intrusive.
            // Let's just rely on UI updates for now or simple status text.
        }

        // Init
        fetchUsers();
    </script>
</body>
</html>
`;
