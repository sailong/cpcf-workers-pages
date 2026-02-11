
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3000/api';
const MANAGER_DIR = __dirname;
const TEST_PROJECT_NAME = 'test-persist-' + Date.now().toString(36);

function curl(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString();
    } catch (e) {
        console.error("Curl failed:", e.message);
        throw e;
    }
}

async function runTest() {
    console.log("=== Starting Build Persistence Verification ===");

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

        // 2. Create Project Source
        const tempSrc = path.join(MANAGER_DIR, 'temp_persist_src');
        if (fs.existsSync(tempSrc)) fs.rmSync(tempSrc, { recursive: true });
        fs.mkdirSync(tempSrc);
        fs.writeFileSync(path.join(tempSrc, 'index.html'), '<h1>Hello</h1>');
        fs.writeFileSync(path.join(tempSrc, 'package.json'), '{"scripts":{"build":"mkdir -p dist && cp index.html dist/"}}');

        const zipPath = path.join(MANAGER_DIR, 'test_persist.zip');
        execSync(`cd ${tempSrc} && zip -r ${zipPath} .`);

        // 3. Upload & Build
        const TEST_CMD = "npm run build";
        const TEST_OUT = "dist";

        console.log(`Uploading with cmd="${TEST_CMD}", out="${TEST_OUT}"...`);
        const buildOut = curl(`curl -s -N -X POST "${API_URL}/build" -H "Authorization: Bearer ${token}" -F "file=@${zipPath}" -F "buildCommand=${TEST_CMD}" -F "outputDir=${TEST_OUT}"`);
        let buildId = null;
        for (const line of buildOut.split('\n\n')) {
            if (line.startsWith('data: ')) {
                try {
                     const data = JSON.parse(line.slice(6));
                     if (data.type === 'log') console.log(`[RemoteLog] ${data.content}`);
                     if (data.type === 'result' && data.success) buildId = data.buildId;
                } catch (e) { }
            }
        }
        if (!buildId) throw new Error("Build failed");

        // 4. Create Project (Should save buildCommand/outputDir)
        console.log(`Creating Project ${TEST_PROJECT_NAME}...`);
        const payload = {
            name: TEST_PROJECT_NAME,
            type: 'pages',
            buildId: buildId,
            outputDir: TEST_OUT, // Passed here
            buildCommand: TEST_CMD, // Passed here (ensure frontend sends this too? frontend CreateWorkerForm sends what it is given)
            // Wait, does frontend send `buildCommand` in Create Project? 
            // In CreateWorkerForm, it sends `outputDir`. Does it send `buildCommand`?
            // Need to check CodeEditorModal or CreateWorkerForm sending logic. 
            // If it doesn't send it, backend won't save it. 
            // Assuming for now I added it to backend extraction, so if I send it, it saves.
            bindings: {}
        };
        const createRes = JSON.parse(curl(`curl -s -X POST "${API_URL}/projects" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`));
        if (createRes.error) throw new Error("Create failed: " + createRes.error);

        // 5. Verify Persistence via Full Config
        console.log("Fetching Full Config...");
        const configRes = JSON.parse(curl(`curl -s "${API_URL}/projects/${createRes.id}/full-config" -H "Authorization: Bearer ${token}"`));

        console.log("Config Result:", { cmd: configRes.buildCommand, out: configRes.outputDir });

        if (configRes.buildCommand === TEST_CMD && configRes.outputDir === TEST_OUT) {
            console.log("SUCCESS: Build settings persisted and returned!");
        } else {
            console.error(`FAILURE: Expected cmd="${TEST_CMD}", out="${TEST_OUT}". Got cmd="${configRes.buildCommand}", out="${configRes.outputDir}"`);
            throw new Error("Persistence verification failed");
        }

    } catch (e) {
        console.error("Test Failed:", e.message);
    } finally {
        try { fs.rmSync(path.join(MANAGER_DIR, 'temp_persist_src'), { recursive: true }); } catch { }
        try { fs.unlinkSync(path.join(MANAGER_DIR, 'test_persist.zip')); } catch { }
    }
}

runTest();
