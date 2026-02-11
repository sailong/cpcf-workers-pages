
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

// Configuration
const API_URL = 'http://localhost:3000/api';
const MANAGER_DIR = __dirname;
const TEST_PROJECT_NAME = 'test-binding-' + Date.now().toString(36);

function curl(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString();
    } catch (e) {
        console.error("Curl failed:", e.message);
        throw e;
    }
}

async function runTest() {
    console.log("=== Starting Pages Binding Verification ===");

    try {
        // 1. Auth
        const AUTH_FILE = path.join(MANAGER_DIR, '../.platform-data/auth.json');
        const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
        const JWT_SECRET = authData.jwtSecret;
        const PASSWORD = authData.password;
        const captchaText = 'abcd';
        const captchaId = jwt.sign({ text: captchaText }, JWT_SECRET, { expiresIn: '5m' });

        const rawLogin = curl(`curl -s -X POST "${API_URL}/login" -H "Content-Type: application/json" -d '${JSON.stringify({ username: 'admin', password: PASSWORD, captcha: captchaText, captchaId: captchaId })}'`);
        const token = JSON.parse(rawLogin).token;

        // 2. Create Resources (KV & D1)
        console.log("Creating KV & D1 resources...");

        const rawKv = curl(`curl -s -X POST "${API_URL}/resources/kv" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"name":"TestKV"}'`);
        let kvRes;
        try { kvRes = JSON.parse(rawKv); } catch (e) { /* existing check */ }

        const rawD1 = curl(`curl -s -X POST "${API_URL}/resources/d1" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"name":"TestD1"}'`);

        // Fetch Resources List to get IDs
        const kvList = JSON.parse(curl(`curl -s "${API_URL}/resources/kv" -H "Authorization: Bearer ${token}"`));
        const kvId = kvList.find(k => k.name === 'TestKV').id;

        const d1List = JSON.parse(curl(`curl -s "${API_URL}/resources/d1" -H "Authorization: Bearer ${token}"`));
        const d1Id = d1List.find(d => d.name === 'TestD1').id;

        console.log(`Using KV: ${kvId}, D1: ${d1Id}`);

        // 3. Create Project Source
        const tempSrc = path.join(MANAGER_DIR, 'temp_binding_src');
        if (fs.existsSync(tempSrc)) fs.rmSync(tempSrc, { recursive: true });
        fs.mkdirSync(tempSrc);

        // _worker.js that checks env
        const workerCode = `
        export default {
            async fetch(request, env) {
                return Response.json({
                    hasKV: !!env.MY_KV,
                    hasD1: !!env.MY_D1,
                    kvId: env.MY_KV ? "present" : "missing",
                    d1Id: env.MY_D1 ? "present" : "missing"
                });
            }
        };`;
        fs.writeFileSync(path.join(tempSrc, '_worker.js'), workerCode);
        fs.writeFileSync(path.join(tempSrc, 'package.json'), '{"scripts":{"build":"mkdir -p dist && cp _worker.js dist/"}}');

        const zipPath = path.join(MANAGER_DIR, 'test_binding.zip');
        execSync(`cd ${tempSrc} && zip -r ${zipPath} .`);

        // 4. Upload & Build
        console.log("Uploading & Building...");
        const buildOut = curl(`curl -s -N -X POST "${API_URL}/build" -H "Authorization: Bearer ${token}" -F "file=@${zipPath}" -F "buildCommand=npm run build" -F "outputDir=dist"`);
        let buildId = null;
        for (const line of buildOut.split('\n\n')) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'result' && data.success) buildId = data.buildId;
                } catch (e) { }
            }
        }
        if (!buildId) throw new Error("Build failed");

        // 5. Create Project with Bindings
        console.log(`Creating Project ${TEST_PROJECT_NAME}...`);
        const payload = {
            name: TEST_PROJECT_NAME,
            type: 'pages',
            buildId: buildId,
            outputDir: 'dist',
            bindings: {
                kv: [{ varName: 'MY_KV', resourceId: kvId }],
                d1: [{ varName: 'MY_D1', resourceId: d1Id }]
            }
        };
        const createRes = JSON.parse(curl(`curl -s -X POST "${API_URL}/projects" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`));
        if (createRes.error) throw new Error("Create failed: " + createRes.error);

        // 6. Start Project
        console.log("Starting Project...");
        const startRes = JSON.parse(curl(`curl -s -X POST "${API_URL}/projects/${createRes.id}/start" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{}'`));
        if (startRes.error) throw new Error("Start failed: " + startRes.error);

        // Wait for start
        await new Promise(r => setTimeout(r, 5000));

        // 7. Test Endpoint
        // IMPORTANT: Use hyphen separator for wildcard support
        // Note: localhost domain logic might strip .localhost first
        // If we use test-binding-xxx-pages.localhost
        // Host header must be test-binding-xxx-pages.localhost

        const hostHeader = `${TEST_PROJECT_NAME}-pages.localhost`;
        const projectUrl = `http://${hostHeader}:3000`;
        console.log(`Querying ${projectUrl}...`);

        const response = curl(`curl -s -H "Host: ${hostHeader}" http://127.0.0.1:3000`);
        console.log("Response:", response);

        if (response.includes('"hasKV":true') && response.includes('"hasD1":true')) {
            console.log("SUCCESS: Bindings are working!");
        } else {
            console.error("FAILURE: Bindings missing.");
        }

    } catch (e) {
        console.error("Test Failed:", e.message);
    } finally {
        try { fs.rmSync(path.join(MANAGER_DIR, 'temp_binding_src'), { recursive: true }); } catch { }
        try { fs.unlinkSync(path.join(MANAGER_DIR, 'test_binding.zip')); } catch { }
    }
}

runTest();
