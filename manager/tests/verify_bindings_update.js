
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

// Configuration
const API_URL = 'http://localhost:3000/api';
const MANAGER_DIR = __dirname;
const TEST_PROJECT_NAME = 'test-update-' + Date.now().toString(36);

function curl(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString();
    } catch (e) {
        console.error("Curl failed:", e.message);
        throw e;
    }
}

async function runTest() {
    console.log("=== Starting Binding UPDATE Verification ===");

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

        // 2. Resources
        const kvList = JSON.parse(curl(`curl -s "${API_URL}/resources/kv" -H "Authorization: Bearer ${token}"`));
        const kvId = kvList[0] ? kvList[0].id : null;
        const d1List = JSON.parse(curl(`curl -s "${API_URL}/resources/d1" -H "Authorization: Bearer ${token}"`));
        const d1Id = d1List[0] ? d1List[0].id : null;

        if (!kvId || !d1Id) throw new Error("Please run previous test to create resources first or manually create them.");
        console.log(`Using KV: ${kvId}, D1: ${d1Id}`);

        // 3. Create Project Source
        const tempSrc = path.join(MANAGER_DIR, 'temp_update_src');
        if (fs.existsSync(tempSrc)) fs.rmSync(tempSrc, { recursive: true });
        fs.mkdirSync(tempSrc);

        const workerCode = `
        export default {
            async fetch(request, env) {
                return Response.json({
                    hasKV: !!env.MY_KV,
                    hasD1: !!env.MY_D1
                });
            }
        };`;
        fs.writeFileSync(path.join(tempSrc, '_worker.js'), workerCode);
        fs.writeFileSync(path.join(tempSrc, 'package.json'), '{"scripts":{"build":"mkdir -p dist && cp _worker.js dist/"}}');

        const zipPath = path.join(MANAGER_DIR, 'test_update.zip');
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

        // 5. Create Project WITHOUT Bindings
        console.log(`Creating Project ${TEST_PROJECT_NAME} (No Bindings)...`);
        const payload = {
            name: TEST_PROJECT_NAME,
            type: 'pages',
            buildId: buildId,
            outputDir: 'dist',
            bindings: {} // Empty
        };
        const createRes = JSON.parse(curl(`curl -s -X POST "${API_URL}/projects" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`));
        if (createRes.error) throw new Error("Create failed: " + createRes.error);

        // 6. Start Project
        console.log("Starting Project...");
        const startRes = JSON.parse(curl(`curl -s -X POST "${API_URL}/projects/${createRes.id}/start" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{}'`));
        if (startRes.error) throw new Error("Start failed: " + startRes.error);

        // Wait for start
        await new Promise(r => setTimeout(r, 5000));

        // 7. Verify Bindings MISSING
        const hostHeader = `${TEST_PROJECT_NAME}-pages.localhost`;
        const projectUrl = `http://${hostHeader}:3000`;
        console.log(`Querying ${projectUrl} (Expect Missing)...`);

        const response1 = curl(`curl -s -H "Host: ${hostHeader}" http://127.0.0.1:3000`);
        console.log("Response 1:", response1);

        if (response1.includes('"hasKV":true') || response1.includes('"hasD1":true')) {
            throw new Error("FAILURE: Bindings present when should be missing!");
        }
        console.log("Verified bindings are missing.");

        // 8. Update Bindings
        console.log("Updating Bindings...");
        const updatePayload = {
            bindings: {
                kv: [{ varName: 'MY_KV', resourceId: kvId }],
                d1: [{ varName: 'MY_D1', resourceId: d1Id }]
            }
        };
        const updateRes = JSON.parse(curl(`curl -s -X PUT "${API_URL}/projects/${createRes.id}/config" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${JSON.stringify(updatePayload)}'`));
        if (updateRes.error) throw new Error("Update failed: " + updateRes.error);
        console.log("Update response:", updateRes);

        // Wait for restart (server logic waits 1s then starts, so giving 5s is safe)
        console.log("Waiting for restart...");
        await new Promise(r => setTimeout(r, 6000));

        // 9. Verify Bindings PRESENT
        console.log(`Querying ${projectUrl} (Expect Present)...`);
        const response2 = curl(`curl -s -H "Host: ${hostHeader}" http://127.0.0.1:3000`);
        console.log("Response 2:", response2);

        if (response2.includes('"hasKV":true') && response2.includes('"hasD1":true')) {
            console.log("SUCCESS: Bindings updated and working!");
        } else {
            throw new Error("FAILURE: Bindings still missing after update.");
        }

    } catch (e) {
        console.error("Test Failed:", e.message);
    } finally {
        try { fs.rmSync(path.join(MANAGER_DIR, 'temp_update_src'), { recursive: true }); } catch { }
        try { fs.unlinkSync(path.join(MANAGER_DIR, 'test_update.zip')); } catch { }
    }
}

runTest();
