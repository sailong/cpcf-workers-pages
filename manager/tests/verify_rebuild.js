
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

// Configuration
const API_URL = 'http://localhost:3000/api';
const MANAGER_DIR = __dirname;
const TEST_PROJECT_NAME = 'test-rebuild-' + Date.now().toString(36);

// Helper to execute curl
function curl(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString();
    } catch (e) {
        console.error("Curl failed:", e.message);
        throw e;
    }
}

async function runTest() {
    console.log("=== Starting Rebuild Feature Verification (With Captcha) ===");

    try {
        // 1. Read Auth & Generate Captcha
        const AUTH_FILE = path.join(MANAGER_DIR, '../.platform-data/auth.json');
        if (!fs.existsSync(AUTH_FILE)) throw new Error("Auth file not found at " + AUTH_FILE);

        const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
        const JWT_SECRET = authData.jwtSecret;
        const PASSWORD = authData.password;

        console.log("Generating Captcha Token...");
        const captchaText = 'abcd';
        const captchaId = jwt.sign({ text: captchaText }, JWT_SECRET, { expiresIn: '5m' });

        // 2. Login
        console.log("Logging in...");
        const rawLogin = curl(`curl -s -X POST "${API_URL}/login" -H "Content-Type: application/json" -d '${JSON.stringify({ username: 'admin', password: PASSWORD, captcha: captchaText, captchaId: captchaId })}'`);
        const loginRes = JSON.parse(rawLogin);

        if (loginRes.error) throw new Error("Login API Error: " + loginRes.error);
        const token = loginRes.token;
        if (!token) throw new Error("Login failed (no token)");
        console.log("Login successful.");

        // 3. Create dummy source & zip
        const tempSrc = path.join(MANAGER_DIR, 'temp_src_captcha');
        if (fs.existsSync(tempSrc)) fs.rmSync(tempSrc, { recursive: true });
        fs.mkdirSync(tempSrc);
        fs.writeFileSync(path.join(tempSrc, 'index.html'), '<h1>Version 1</h1>');
        fs.writeFileSync(path.join(tempSrc, 'package.json'), '{"scripts":{"build":"mkdir -p dist && cp index.html dist/"}}');

        const zipPath = path.join(MANAGER_DIR, 'test_project_captcha.zip');
        execSync(`cd ${tempSrc} && zip -r ${zipPath} .`);

        // 4. Upload & Build (Get BuildId)
        console.log("Uploading to /api/build...");
        const buildOut = curl(`curl -s -N -X POST "${API_URL}/build" -H "Authorization: Bearer ${token}" -F "file=@${zipPath}" -F "buildCommand=npm run build" -F "outputDir=dist"`);

        let buildId = null;
        const lines = buildOut.split('\n\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'result' && data.success) buildId = data.buildId;
                } catch (e) { }
            }
        }
        if (!buildId) throw new Error("Failed to get buildId");
        console.log("Build successful. BuildId:", buildId);

        // 5. Create Project
        console.log("Creating project...");
        const createCmd = `curl -s -X POST "${API_URL}/projects" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${JSON.stringify({ name: TEST_PROJECT_NAME, type: 'pages', buildId: buildId, outputDir: 'dist' })}'`;
        const createRes = JSON.parse(curl(createCmd));
        if (createRes.error) throw new Error("Create Project Error: " + createRes.error);

        // 6. Verify Filesystem
        console.log("Fetching project details to resolve directory...");
        const projectsList = JSON.parse(curl(`curl -s "${API_URL}/projects" -H "Authorization: Bearer ${token}"`));
        const project = projectsList.find(p => p.name === TEST_PROJECT_NAME); // projectsList is the array        if (!project) throw new Error("Project not found in list after creation");

        // Resolve Directory directly from mainFile logic
        let relativeRoot = path.dirname(project.mainFile);
        if (relativeRoot === '.') relativeRoot = project.mainFile; // Should not happen with dist structure but safety

        // UPLOADS_DIR is relative to server.js (../.platform-data/uploads)
        // From here (manager/verify_rebuild.js), it is ../.platform-data/uploads
        const projectDir = path.join(MANAGER_DIR, '../.platform-data/uploads', relativeRoot);

        const sourceDir = path.join(projectDir, 'source');
        const distDir = path.join(projectDir, 'dist');

        console.log("Checking dirs:", sourceDir);
        if (!fs.existsSync(sourceDir)) throw new Error("Source directory missing at " + sourceDir);
        if (!fs.existsSync(distDir)) throw new Error("Dist directory missing at " + distDir);
        console.log("Filesystem verified.");

        // 7. Modify Source
        fs.writeFileSync(path.join(sourceDir, 'index.html'), '<h1>Version 2 (Rebuilt)</h1>');
        console.log("Modified source code.");

        // 8. Trigger Rebuild
        console.log("Triggering Rebuild...");
        const rebuildCmd = `curl -s -N -X POST "${API_URL}/projects/${project.id}/rebuild" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${JSON.stringify({ buildCommand: "npm run build", outputDir: "dist" })}'`;
        const rebuildOut = curl(rebuildCmd);
        // Print Logs
        const lines2 = rebuildOut.split('\n\n');
        for (const line of lines2) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'log') console.log(`[RebuildLog] ${data.content}`);
                } catch (e) { }
            }
        }

        // Wait for output processing (curl returns it all)
        if (!rebuildOut.includes('"success":true')) throw new Error("Rebuild failed (no success in output). Output: " + rebuildOut.substring(0, 200));
        console.log("Rebuild request successful.");

        // 9. Verify Dist Content
        // Need to wait? SSE stream returns only when done. So file should be ready.
        const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
        if (indexHtml.includes('Version 2')) {
            console.log("SUCCESS: Dist contains 'Version 2'.");
        } else {
            throw new Error(`FAILURE: Dist content is: ${indexHtml}`);
        }

    } catch (e) {
        console.error("Test Failed:", e.message);
    } finally {
        try { fs.rmSync(path.join(MANAGER_DIR, 'temp_src_captcha'), { recursive: true }); } catch { }
        try { fs.unlinkSync(path.join(MANAGER_DIR, 'test_project_captcha.zip')); } catch { }
        // Cleanup project
        // try {
        //   // curl delete...
        // } catch {}
    }
}

runTest();
