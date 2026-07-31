import { test, expect } from '@playwright/test';
import yazl from 'yazl';

async function createSiteZip(html) {
  const archive = new yazl.ZipFile();
  archive.addBuffer(Buffer.from(html), 'index.html');
  archive.end();
  const chunks = [];
  for await (const chunk of archive.outputStream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test.describe('CCFWP 登录后全功能自动化测试', () => {
  const testPassword = process.env.CCFWP_TEST_PASSWORD;
  const testCaptcha = process.env.CCFWP_TEST_CAPTCHA;

  test('真实登录表单提交并建立浏览器会话', async ({ page }) => {
    if (!testPassword || !testCaptcha) {
      throw new Error('CCFWP_TEST_PASSWORD and CCFWP_TEST_CAPTCHA are required for authenticated E2E tests');
    }

    await page.goto('/login');
    await expect(page.locator('#login-captcha')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    await page.locator('#login-password').fill(testPassword);
    await page.locator('#login-captcha').fill(testCaptcha);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: /退出登录|Logout/ })).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.some(cookie => /session/i.test(cookie.name) && cookie.value)).toBe(true);
  });

  async function login(page) {
    if (!testPassword || !testCaptcha) {
      throw new Error('CCFWP_TEST_PASSWORD and CCFWP_TEST_CAPTCHA are required for authenticated E2E tests');
    }
    console.log('🔐 执行登录...');
    await page.goto('/login');
    const captchaRes = await page.request.get('/api/captcha');
    const captchaData = await captchaRes.json();
    const loginRes = await page.request.post('/api/login', {
      data: {
        username: 'admin',
        password: testPassword,
        captcha: testCaptcha,
        captchaId: captchaData.captchaId
      }
    });
    const loginBody = await loginRes.text();
    expect(loginRes.ok(), loginBody).toBe(true);
    await page.goto('/');
    console.log('  ✅ API 登录成功，会话 Cookie 已设置');
    await expect(page.getByRole('button', { name: /退出登录|Logout/ })).toBeVisible();
  }

  async function browserApi(page, path, options = {}) {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const response = await page.request.fetch(path, {
      method: options.method || 'GET',
      data: options.data,
      headers: {
        ...(options.headers || {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {})
      }
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: response.ok(), status: response.status(), data, text };
  }

  async function browserSse(page, path, options = {}) {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const headers = cookieHeader ? { Cookie: cookieHeader } : undefined;
    let response;
    if (options.fileBase64) {
      const multipart = {
        file: {
          name: options.filename || 'site.zip',
          mimeType: 'application/zip',
          buffer: Buffer.from(options.fileBase64, 'base64')
        },
        ...Object.fromEntries(Object.entries(options.fields || {}).map(([key, value]) => [key, String(value)]))
      };
      response = await page.request.post(path, { multipart, headers });
    } else {
      response = await page.request.post(path, { data: options.data || {}, headers });
    }
    const text = await response.text();
    const messages = text.split('\n\n')
      .filter(block => block.startsWith('data: '))
      .map(block => JSON.parse(block.slice(6)));
    const error = messages.find(message => message.type === 'error');
    const result = messages.findLast(message => message.type === 'result');
    return { ok: response.ok() && !error && Boolean(result), status: response.status(), error, result, text };
  }

  test('登录后完整功能验证', async ({ page }) => {
    console.log('\n🚀 开始 CCFWP 登录后全功能测试...\n');
    
    const results = {
      dashboard: false,
      resources: false,
      kvManagement: false,
      d1Management: false,
      r2Management: false,
      createProject: false,
      settings: false,
      logout: false,
    };

    // ==========================================
    // 0. 执行登录
    // ==========================================
    await login(page);

    // ==========================================
    // 1. 仪表盘功能测试
    // ==========================================
    console.log('\n📋 测试 1: 仪表盘功能');
    await page.goto('/');
    
    // 验证页面元素
    const dashboardTitle = page.locator('h1');
    await expect(dashboardTitle).toBeVisible({ timeout: 5000 });
    const titleText = await dashboardTitle.textContent();
    console.log(`  页面标题: ${titleText?.trim()}`);
    
    // 验证功能按钮
    const resourceBtn = page.getByRole('button', { name: /资源管理|Resources/ });
    await expect(resourceBtn).toBeVisible();
    console.log('  ✅ 资源管理按钮可见');
    
    const newProjectBtn = page.locator('header.console-topbar').getByRole('button', { name: /新建项目|Create Project/ });
    await expect(newProjectBtn).toBeVisible();
    console.log('  ✅ 新建项目按钮可见');
    
    // 验证主题切换
    const themeToggle = page.getByRole('button', { name: /切换亮色|切换暗色|Switch to (Light|Dark) Mode/ });
    await expect(themeToggle).toBeVisible();
    console.log('  ✅ 主题切换按钮可见');
    
    // 验证语言切换
    const langToggle = page.getByRole('button', { name: /切换到英文|切换到中文|Switch to (English|Chinese)/ });
    await expect(langToggle).toBeVisible();
    console.log('  ✅ 语言切换按钮可见');
    
    // 验证修改密码按钮
    const passwordBtn = page.getByRole('button', { name: /修改密码|Change Password/ });
    await expect(passwordBtn).toBeVisible();
    console.log('  ✅ 修改密码按钮可见');
    
    // 验证退出登录按钮
    const logoutBtn = page.getByRole('button', { name: /退出登录|Logout/ });
    await expect(logoutBtn).toBeVisible();
    console.log('  ✅ 退出登录按钮可见');
    
    // 测试主题切换
    const initialTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await themeToggle.click();
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).not.toBe(initialTheme);
    const newTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log(`  主题切换: ${initialTheme ? '深色' : '浅色'} → ${newTheme ? '深色' : '浅色'} ✅`);
    
    results.dashboard = true;
    console.log('✅ 测试 1 通过: 仪表盘功能正常\n');

    // ==========================================
    // 2. 资源管理页面测试
    // ==========================================
    console.log('📋 测试 2: 资源管理页面');
    await resourceBtn.click();
    
    // 验证 Tab 切换
    const kvTab = page.getByRole('tab', { name: /KV (存储|Storage)/ });
    const d1Tab = page.getByRole('tab', { name: /D1 (数据库|Database)/ });
    const r2Tab = page.getByRole('tab', { name: /R2 (存储桶|Bucket)/ });
    
    await expect(kvTab).toBeVisible();
    console.log('  ✅ KV 存储 Tab 可见');
    
    await expect(d1Tab).toBeVisible();
    console.log('  ✅ D1 数据库 Tab 可见');
    
    await expect(r2Tab).toBeVisible();
    console.log('  ✅ R2 存储桶 Tab 可见');
    
    // 测试 Tab 切换
    await d1Tab.click();
    await expect(d1Tab).toHaveAttribute('aria-selected', 'true');
    console.log('  ✅ D1 Tab 切换成功');
    
    await r2Tab.click();
    await expect(r2Tab).toHaveAttribute('aria-selected', 'true');
    console.log('  ✅ R2 Tab 切换成功');
    
    await kvTab.click();
    await expect(kvTab).toHaveAttribute('aria-selected', 'true');
    console.log('  ✅ KV Tab 切换成功');
    
    results.resources = true;
    console.log('✅ 测试 2 通过: 资源管理页面正常\n');

    // ==========================================
    // 3. KV 管理功能测试
    // ==========================================
    console.log('📋 测试 3: KV 管理功能');
    await kvTab.click();
    await expect(kvTab).toHaveAttribute('aria-selected', 'true');
    
    // 验证创建按钮
    const createBtn = page.locator('button:has-text("创建"), button:has-text("Create")');
    await expect(createBtn.first()).toBeVisible();
    console.log('  ✅ 创建按钮可见');
    
    // 验证输入框
    const nameInput = page.getByPlaceholder(/命名空间名称|namespace name/i);
    await expect(nameInput).toBeVisible();
    console.log('  ✅ 名称输入框可见');
    
    results.kvManagement = true;
    console.log('✅ 测试 3 通过: KV 管理功能正常\n');

    // ==========================================
    // 4. D1 管理功能测试
    // ==========================================
    console.log('📋 测试 4: D1 管理功能');
    await d1Tab.click();
    await expect(d1Tab).toHaveAttribute('aria-selected', 'true');
    
    // 验证创建按钮
    await expect(createBtn.first()).toBeVisible();
    console.log('  ✅ 创建按钮可见');
    
    // 验证输入框
    const d1NameInput = page.getByPlaceholder(/数据库名称|database name/i);
    await expect(d1NameInput).toBeVisible();
    console.log('  ✅ 名称输入框可见');
    
    results.d1Management = true;
    console.log('✅ 测试 4 通过: D1 管理功能正常\n');

    // ==========================================
    // 5. R2 管理功能测试
    // ==========================================
    console.log('📋 测试 5: R2 管理功能');
    await r2Tab.click();
    await expect(r2Tab).toHaveAttribute('aria-selected', 'true');
    
    // 验证创建按钮
    await expect(createBtn.first()).toBeVisible();
    console.log('  ✅ 创建按钮可见');
    
    // 验证输入框
    const r2NameInput = page.getByPlaceholder(/存储桶名称|bucket name/i);
    await expect(r2NameInput).toBeVisible();
    console.log('  ✅ 名称输入框可见');
    
    results.r2Management = true;
    console.log('✅ 测试 5 通过: R2 管理功能正常\n');

    // ==========================================
    // 6. 创建项目页面测试
    // ==========================================
    console.log('📋 测试 6: 创建项目页面');
    await page.goto('/create');
    
    // 验证项目类型选择
    const workerType = page.getByRole('tab', { name: /Worker/ }).first();
    const pagesType = page.getByRole('tab', { name: /Pages/ }).first();
    const buildType = page.getByRole('tab', { name: /Build/ }).first();
    
    await expect(workerType).toBeVisible();
    console.log('  ✅ Worker 类型可见');
    
    await expect(pagesType).toBeVisible();
    console.log('  ✅ Pages 类型可见');
    
    await expect(buildType).toBeVisible();
    console.log('  ✅ Build 类型可见');
    
    // 测试类型切换
    await pagesType.click();
    await expect(pagesType).toHaveAttribute('aria-selected', 'true');
    console.log('  ✅ Pages 类型切换成功');
    
    await buildType.click();
    await expect(buildType).toHaveAttribute('aria-selected', 'true');
    console.log('  ✅ Build 类型切换成功');
    
    // 验证表单元素
    const projectNameInput = page.getByPlaceholder(/my-awesome-worker|my-static-site/);
    await expect(projectNameInput).toBeVisible();
    console.log('  ✅ 项目名称输入框可见');
    
    const portInput = page.getByPlaceholder(/自动分配|Auto-assigned/i);
    await expect(portInput).toBeVisible();
    console.log('  ✅ 端口输入框可见');
    
    // 验证创建按钮
    const createProjectBtn = page.getByRole('button', { name: /创建并部署|Create & Deploy/i });
    await expect(createProjectBtn).toBeVisible();
    console.log('  ✅ 创建按钮可见');
    
    results.createProject = true;
    console.log('✅ 测试 6 通过: 创建项目页面正常\n');

    // ==========================================
    // 7. 修改密码功能测试
    // ==========================================
    console.log('📋 测试 7: 修改密码功能');
    await page.goto('/');
    await expect(passwordBtn).toBeVisible();
    
    // 点击修改密码按钮
    await passwordBtn.click();
    
    // 验证弹窗
    const passwordDialog = page.getByRole('dialog', { name: /修改密码|Change Password/ });
    const modalTitle = passwordDialog.getByRole('heading', { name: /修改密码|Change Password/ });
    await expect(modalTitle).toBeVisible();
    console.log('  ✅ 修改密码弹窗可见');
    
    // 验证输入框
    const passwordInputs = passwordDialog.locator('input[type="password"]');
    const count = await passwordInputs.count();
    expect(count).toBeGreaterThanOrEqual(3);
    console.log(`  ✅ 密码输入框数量: ${count}`);
    
    // 验证按钮
    const cancelBtn = passwordDialog.getByRole('button', { name: /取消|Cancel/ });
    await expect(cancelBtn).toBeVisible();
    console.log('  ✅ 取消按钮可见');
    
    const confirmBtn = passwordDialog.getByRole('button', { name: /修改密码|Change Password/ });
    await expect(confirmBtn).toBeVisible();
    console.log('  ✅ 确认按钮可见');
    
    // 关闭弹窗
    await cancelBtn.click();
    await expect(passwordDialog).toBeHidden();
    console.log('  ✅ 弹窗关闭成功');
    
    results.settings = true;
    console.log('✅ 测试 7 通过: 修改密码功能正常\n');

    // ==========================================
    // 8. 响应式设计测试
    // ==========================================
    console.log('📋 测试 8: 响应式设计测试');
    
    // 移动端
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(dashboardTitle).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const mobileVisible = await dashboardTitle.isVisible();
    console.log(`  移动端 (375px): ${mobileVisible ? '✅ 正常' : '❌ 异常'}`);
    
    // 平板
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(dashboardTitle).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const tabletVisible = await dashboardTitle.isVisible();
    console.log(`  平板端 (768px): ${tabletVisible ? '✅ 正常' : '❌ 异常'}`);
    
    // 桌面
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(dashboardTitle).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const desktopVisible = await dashboardTitle.isVisible();
    console.log(`  桌面端 (1920px): ${desktopVisible ? '✅ 正常' : '❌ 异常'}`);
    
    results.logout = true;
    console.log('✅ 测试 8 通过: 响应式设计正常\n');

    // ==========================================
    // 测试总结
    // ==========================================
    console.log('\n' + '='.repeat(70));
    console.log('🎉 CCFWP 登录后全功能测试完成！');
    console.log('='.repeat(70));
    console.log(`✅ 仪表盘功能: ${results.dashboard ? '通过' : '失败'}`);
    console.log(`✅ 资源管理页面: ${results.resources ? '通过' : '失败'}`);
    console.log(`✅ KV 管理功能: ${results.kvManagement ? '通过' : '失败'}`);
    console.log(`✅ D1 管理功能: ${results.d1Management ? '通过' : '失败'}`);
    console.log(`✅ R2 管理功能: ${results.r2Management ? '通过' : '失败'}`);
    console.log(`✅ 创建项目页面: ${results.createProject ? '通过' : '失败'}`);
    console.log(`✅ 修改密码功能: ${results.settings ? '通过' : '失败'}`);
    console.log(`✅ 响应式设计: ${results.logout ? '通过' : '失败'}`);
    console.log('='.repeat(70));
    
    const passedCount = Object.values(results).filter(r => r === true).length;
    const totalCount = Object.values(results).length;
    console.log(`\n📊 总体结果: ${passedCount}/${totalCount} 测试通过`);
    console.log('='.repeat(70) + '\n');
    
    expect(passedCount).toBe(totalCount);
  });

  test('Worker 核心流程：不可变发布、真实响应、一键回滚、停止和删除', async ({ page, request }) => {
    await login(page);
    const projectName = `e2e-worker-${Date.now()}`;
    const monacoFailures = [];
    const externalMonacoRequests = [];
    let projectId;

    page.on('console', message => {
      if (message.type() === 'error' && /Content Security Policy|Monaco initialization|cdn\.jsdelivr\.net|worker/i.test(message.text())) {
        monacoFailures.push(message.text());
      }
    });
    page.on('pageerror', error => {
      if (/monaco|worker|Content Security Policy/i.test(error.message)) monacoFailures.push(error.message);
    });
    page.on('request', request => {
      if (/cdn\.jsdelivr\.net|\/min\/vs\/loader\.js/i.test(request.url())) externalMonacoRequests.push(request.url());
    });

    try {
      const createRes = await browserApi(page, '/api/projects', {
        method: 'POST',
        data: {
          name: projectName,
          type: 'worker',
          code: 'export default { async fetch() { return new Response("v1"); } };',
          filename: 'worker.js',
          bindings: { kv: [], d1: [], r2: [] },
          envVars: {}
        }
      });
      const project = createRes.data;
      expect(createRes.ok, createRes.text).toBe(true);
      projectId = project.id;

      await page.goto('/');
      await expect(page.getByRole('button', { name: new RegExp(`^${projectName}`) })).toBeVisible();
      await page.getByRole('button', { name: new RegExp(`(编辑|Edit) ${projectName}`) }).click();
      await expect(page.getByText(projectName).first()).toBeVisible();
      await page.getByRole('tab', { name: /^(代码|Code)$/ }).click();
      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15_000 });
      expect(externalMonacoRequests).toEqual([]);
      expect(monacoFailures).toEqual([]);

      const initialCode = await browserApi(page, `/api/projects/${projectId}/code`);
      expect(initialCode.ok, initialCode.text).toBe(true);
      expect(initialCode.data.code).toContain('v1');

      const updatedSource = 'export default { async fetch() { return new Response("v2"); } };';
      const updateRes = await browserApi(page, `/api/projects/${projectId}/code`, { method: 'PUT', data: { code: updatedSource } });
      expect(updateRes.ok, updateRes.text).toBe(true);
      const updatedCode = await browserApi(page, `/api/projects/${projectId}/code`);
      expect(updatedCode.data.code).toContain('v2');

      await page.getByRole('tab', { name: /^(设置|Settings)$/ }).click();
      await expect(page.getByRole('heading', { name: /项目限额|Project limits/ })).toBeVisible();
      const concurrencyInput = page.getByLabel(/并发请求数|Concurrent requests/);
      await concurrencyInput.fill('7');
      await expect(concurrencyInput).toHaveValue('7');
      const configResponsePromise = page.waitForResponse(response =>
        response.request().method() === 'PATCH' && response.url().endsWith(`/api/projects/${projectId}`)
      );
      await page.getByRole('button', { name: /^(保存|Save)$/ }).click();
      const configResponse = await configResponsePromise;
      expect(configResponse.ok(), await configResponse.text()).toBe(true);
      expect(configResponse.request().postDataJSON().limits.concurrentRequests).toBe(7);
      await expect.poll(async () => {
        const projects = await browserApi(page, '/api/projects');
        return projects.data.find(item => item.id === projectId)?.limits.concurrentRequests;
      }).toBe(7);

      const startRes = await browserApi(page, `/api/projects/${projectId}/start`, { method: 'POST', data: {} });
      expect(startRes.ok, startRes.text).toBe(true);
      expect(startRes.data.project.status).toBe('running');

      const runtimeHost = `${projectName}-worker.localhost`;
      await expect.poll(async () => {
        const response = await request.get('/', { headers: { Host: runtimeHost } });
        return { status: response.status(), body: await response.text() };
      }, {
        message: 'Worker runtime should become reachable through the project host',
        timeout: 30_000,
        intervals: [250, 500, 1000]
      }).toEqual({ status: 200, body: 'v2' });

      const releasesRes = await browserApi(page, `/api/projects/${projectId}/releases`);
      expect(releasesRes.ok, releasesRes.text).toBe(true);
      expect(releasesRes.data).toHaveLength(2);
      expect(releasesRes.data.filter(release => release.active)).toHaveLength(1);

      await page.getByRole('tab', { name: /^(部署|Deployments)$/ }).click();
      await expect(page.getByRole('heading', { name: /发布历史|Release history/ })).toBeVisible();
      const releasesTable = page.getByRole('table', { name: /发布历史|Release history/ });
      await expect(releasesTable.locator('tbody tr')).toHaveCount(2);
      await page.getByRole('button', { name: /回滚上一版本|Rollback previous/ }).click();
      const rollbackDialog = page.getByRole('alertdialog');
      await expect(rollbackDialog).toBeVisible();
      await rollbackDialog.getByRole('button', { name: /回滚|Rollback/ }).click();
      await expect.poll(async () => {
        const response = await request.get('/', { headers: { Host: runtimeHost } });
        return { status: response.status(), body: await response.text() };
      }, {
        message: 'Rollback should restart the Worker on the previous immutable release',
        timeout: 30_000,
        intervals: [250, 500, 1000]
      }).toEqual({ status: 200, body: 'v1' });

      const stopRes = await browserApi(page, `/api/projects/${projectId}/stop`, { method: 'POST' });
      expect(stopRes.ok, stopRes.text).toBe(true);
      expect(stopRes.data.project.status).toBe('stopped');

      const stoppedResponse = await request.get('/', { headers: { Host: runtimeHost } });
      expect(stoppedResponse.status()).toBe(404);
    } finally {
      if (projectId) {
        const deleteRes = await browserApi(page, `/api/projects/${projectId}`, { method: 'DELETE' });
        expect(deleteRes.ok, deleteRes.text).toBe(true);
      }
    }
  });

  test('D1 核心流程：读写、回收站名称保留和永久清理', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const resourceName = `e2e-d1-${Date.now()}`;
    const createdIds = [];

    try {
      const createRes = await browserApi(page, '/api/resources/d1', {
        method: 'POST',
        data: { name: resourceName }
      });
      expect(createRes.ok, createRes.text).toBe(true);
      createdIds.push(createRes.data.id);

      for (const sql of [
        'CREATE TABLE notes (id INTEGER PRIMARY KEY, value TEXT)',
        "INSERT INTO notes (value) VALUES ('verified')"
      ]) {
        const executeRes = await browserApi(page, `/api/resources/d1/${createRes.data.id}/execute`, {
          method: 'POST',
          data: { sql }
        });
        expect(executeRes.ok, executeRes.text).toBe(true);
      }

      const selectRes = await browserApi(page, `/api/resources/d1/${createRes.data.id}/execute`, {
        method: 'POST',
        data: { sql: 'SELECT value FROM notes ORDER BY id' }
      });
      expect(selectRes.ok, selectRes.text).toBe(true);
      expect(selectRes.data).toEqual({ columns: ['value'], rows: [['verified']] });

      const trashRes = await browserApi(page, `/api/resources/d1/${createRes.data.id}`, { method: 'DELETE' });
      expect(trashRes.ok, trashRes.text).toBe(true);

      const duplicateRes = await browserApi(page, '/api/resources/d1', {
        method: 'POST',
        data: { name: resourceName }
      });
      expect(duplicateRes.status).toBe(409);

      const listTrashRes = await browserApi(page, '/api/trash');
      expect(listTrashRes.ok, listTrashRes.text).toBe(true);
      expect(listTrashRes.data.some(resource => resource.id === createRes.data.id)).toBe(true);

      const purgeRes = await browserApi(page, `/api/trash/${createRes.data.id}`, { method: 'DELETE' });
      expect(purgeRes.ok, purgeRes.text).toBe(true);
      createdIds.splice(createdIds.indexOf(createRes.data.id), 1);

      const recreateRes = await browserApi(page, '/api/resources/d1', {
        method: 'POST',
        data: { name: resourceName }
      });
      expect(recreateRes.ok, recreateRes.text).toBe(true);
      expect(recreateRes.data.id).not.toBe(createRes.data.id);
      createdIds.push(recreateRes.data.id);
    } finally {
      for (const id of createdIds) {
        await browserApi(page, `/api/resources/d1/${id}`, { method: 'DELETE' });
        await browserApi(page, `/api/trash/${id}`, { method: 'DELETE' });
      }
    }
  });

  test('Pages 核心流程：ZIP 上传、不可变部署、真实响应和回滚', async ({ page, request }) => {
    test.setTimeout(120_000);
    await login(page);
    const projectName = `e2e-pages-${Date.now()}`;
    let projectId;

    try {
      const firstZip = await createSiteZip('<!doctype html><title>v1</title><main>pages-v1</main>');
      const uploadRes = await browserSse(page, '/api/upload', {
        fileBase64: firstZip.toString('base64'),
        filename: 'site-v1.zip'
      });
      // /api/upload is regular JSON rather than SSE.
      const uploaded = JSON.parse(uploadRes.text);
      expect(uploadRes.status, uploadRes.text).toBe(200);

      const createRes = await browserApi(page, '/api/projects', {
        method: 'POST',
        data: {
          name: projectName,
          type: 'pages',
          mainFile: uploaded.filename,
          bindings: { kv: [], d1: [], r2: [] },
          envVars: {}
        }
      });
      expect(createRes.ok, createRes.text).toBe(true);
      projectId = createRes.data.id;

      const startRes = await browserApi(page, `/api/projects/${projectId}/start`, { method: 'POST', data: {} });
      expect(startRes.ok, startRes.text).toBe(true);
      const runtimeHost = `${projectName}-pages.localhost`;
      await expect.poll(async () => {
        const response = await request.get('/', { headers: { Host: runtimeHost } });
        return await response.text();
      }, { timeout: 30_000, intervals: [250, 500, 1000] }).toContain('pages-v1');

      const secondZip = await createSiteZip('<!doctype html><title>v2</title><main>pages-v2</main>');
      const buildRes = await browserSse(page, '/api/build', {
        fileBase64: secondZip.toString('base64'),
        filename: 'site-v2.zip',
        fields: { buildCommand: '', outputDir: '' }
      });
      expect(buildRes.ok, buildRes.error?.content || buildRes.text).toBe(true);
      const deployRes = await browserSse(page, `/api/projects/${projectId}/deploy`, {
        data: { buildId: buildRes.result.buildId, outputDir: '' }
      });
      expect(deployRes.ok, deployRes.error?.content || deployRes.text).toBe(true);

      await expect.poll(async () => {
        const response = await request.get('/', { headers: { Host: runtimeHost } });
        return await response.text();
      }, { timeout: 30_000, intervals: [250, 500, 1000] }).toContain('pages-v2');

      const rollbackRes = await browserApi(page, `/api/projects/${projectId}/rollback`, { method: 'POST' });
      expect(rollbackRes.ok, rollbackRes.text).toBe(true);
      await expect.poll(async () => {
        const response = await request.get('/', { headers: { Host: runtimeHost } });
        return await response.text();
      }, { timeout: 30_000, intervals: [250, 500, 1000] }).toContain('pages-v1');
    } finally {
      if (projectId) {
        await browserApi(page, `/api/projects/${projectId}/stop`, { method: 'POST' });
        await browserApi(page, `/api/projects/${projectId}`, { method: 'DELETE' });
      }
    }
  });

  test('资源回收站 UI：恢复、重新删除和永久清理', async ({ page }) => {
    await login(page);
    const resourceName = `e2e-trash-${Date.now()}`;
    let resourceId;

    try {
      const created = await browserApi(page, '/api/resources/kv', {
        method: 'POST',
        data: { name: resourceName }
      });
      expect(created.ok, created.text).toBe(true);
      resourceId = created.data.id;

      const deleted = await browserApi(page, `/api/resources/kv/${resourceId}`, { method: 'DELETE' });
      expect(deleted.ok, deleted.text).toBe(true);

      await page.goto('/trash');
      await expect(page.getByText(resourceName, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: new RegExp(`^(恢复|Restore) ${resourceName}$`) }).click();
      await expect(page.getByText(resourceName, { exact: true })).not.toBeVisible();
      const activeResources = await browserApi(page, '/api/resources/kv');
      expect(activeResources.data.some(resource => resource.id === resourceId)).toBe(true);

      const deletedAgain = await browserApi(page, `/api/resources/kv/${resourceId}`, { method: 'DELETE' });
      expect(deletedAgain.ok, deletedAgain.text).toBe(true);
      await page.getByRole('button', { name: /刷新回收站|Refresh trash/ }).click();
      await expect(page.getByText(resourceName, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: new RegExp(`^(永久删除|Delete permanently) ${resourceName}$`) }).click();
      const purgeDialog = page.getByRole('alertdialog', { name: /永久删除资源|Delete resource permanently/ });
      await expect(purgeDialog).toContainText(resourceName);
      await purgeDialog.getByRole('button', { name: /永久删除|Delete permanently/ }).click();
      await expect(page.getByText(resourceName, { exact: true })).not.toBeVisible();

      const trash = await browserApi(page, '/api/trash');
      expect(trash.data.some(resource => resource.id === resourceId)).toBe(false);
      resourceId = undefined;
    } finally {
      if (resourceId) {
        await browserApi(page, `/api/resources/kv/${resourceId}`, { method: 'DELETE' });
        await browserApi(page, `/api/trash/${resourceId}`, { method: 'DELETE' });
      }
    }
  });

  test('运维控制台：响应式项目表与持久化部署日志', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const projectName = `e2e-operations-${Date.now()}`;
    let projectId;

    try {
      const created = await browserApi(page, '/api/projects', {
        method: 'POST',
        data: {
          name: projectName,
          type: 'worker',
          code: 'export default { async fetch() { return new Response("operations"); } };',
          filename: 'worker.js',
          bindings: { kv: [], d1: [], r2: [] },
          envVars: {}
        }
      });
      expect(created.ok, created.text).toBe(true);
      projectId = created.data.id;

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      const projectsTable = page.getByRole('table', { name: /项目运行列表|Project runtime list/ });
      await expect(projectsTable).toBeVisible();
      await expect(projectsTable.getByText(projectName, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /资源占用优先|Highest occupancy/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /失败优先|Failed first/ })).toBeVisible();
      await page.getByRole('button', { name: /失败优先|Failed first/ }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(projectsTable).toBeHidden();
      await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      const rebuild = await browserSse(page, `/api/projects/${projectId}/rebuild`, {
        data: { buildCommand: '', outputDir: '' }
      });
      expect(rebuild.ok, rebuild.error?.content || rebuild.text).toBe(true);

      const deployments = await browserApi(page, `/api/projects/${projectId}/deployments`);
      expect(deployments.ok, deployments.text).toBe(true);
      expect(deployments.data).toHaveLength(1);
      expect(deployments.data[0].status).toBe('succeeded');
      expect(deployments.data[0].logs.some(log => log.content.includes('Building immutable release'))).toBe(true);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.getByRole('button', { name: new RegExp(`(编辑|Edit) ${projectName}`) }).click();
      await page.getByRole('tab', { name: /^(部署|Deployments)$/ }).click();
      await page.getByRole('tab', { name: /操作与日志|Activity and logs/ }).click();
      await expect(page.getByRole('heading', { name: /构建与部署记录|Build and deployment history/ })).toBeVisible();
      await expect(page.getByText(/重新构建|Rebuild/, { exact: true })).toBeVisible();
      const operationsPanel = page.getByTestId('project-operations-panel');
      await expect(operationsPanel.getByText(/成功|Succeeded/, { exact: true })).toBeVisible();
      await expect(operationsPanel.getByLabel(/操作日志|Operation logs/)).toContainText('Building immutable release');

      await page.reload();
      await page.getByRole('button', { name: new RegExp(`(编辑|Edit) ${projectName}`) }).click();
      await page.getByRole('tab', { name: /^(部署|Deployments)$/ }).click();
      await page.getByRole('tab', { name: /操作与日志|Activity and logs/ }).click();
      await expect(page.getByTestId('project-operations-panel').getByLabel(/操作日志|Operation logs/)).toContainText('Building immutable release');
    } finally {
      if (projectId) await browserApi(page, `/api/projects/${projectId}`, { method: 'DELETE' });
    }
  });

  test('创建限额拒绝、跨项目绑定隔离与构建锁文件策略', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const stamp = Date.now();
    const oversizedName = `e2e-limit-${stamp}`;
    const ownerName = `e2e-owner-${stamp}`;
    const strangerName = `e2e-stranger-${stamp}`;
    const resourceName = `e2e-iso-kv-${stamp}`;
    let ownerId;
    let strangerId;
    let resourceId;

    try {
      // Use multipart upload first so the payload can exceed project uploadMb without hitting the JSON body cap.
      const oversizedWorker = Buffer.from(`export default { async fetch() { return new Response(${JSON.stringify('x'.repeat(1_200_000))}); } };`);
      const uploadRes = await browserSse(page, '/api/upload', {
        fileBase64: oversizedWorker.toString('base64'),
        filename: 'oversized-worker.js'
      });
      expect(uploadRes.status, uploadRes.text).toBe(200);
      const uploaded = JSON.parse(uploadRes.text);
      expect(uploaded.filename).toBeTruthy();

      const rejected = await browserApi(page, '/api/projects', {
        method: 'POST',
        data: {
          name: oversizedName,
          type: 'worker',
          mainFile: uploaded.filename,
          bindings: { kv: [], d1: [], r2: [] },
          envVars: {},
          limits: { uploadMb: 1, diskMb: 64 }
        }
      });
      expect(rejected.status).toBe(413);
      expect(String(rejected.data?.error || rejected.text)).toMatch(/upload limit|disk limit|上传|磁盘/i);

      const resource = await browserApi(page, '/api/resources/kv', {
        method: 'POST',
        data: { name: resourceName }
      });
      expect(resource.ok, resource.text).toBe(true);
      resourceId = resource.data.id;

      const owner = await browserApi(page, '/api/projects', {
        method: 'POST',
        data: {
          name: ownerName,
          type: 'worker',
          code: 'export default { async fetch() { return new Response("owner"); } };',
          filename: 'worker.js',
          bindings: { kv: [{ varName: 'CACHE', resourceId }], d1: [], r2: [] },
          envVars: {}
        }
      });
      expect(owner.ok, owner.text).toBe(true);
      ownerId = owner.data.id;

      const stranger = await browserApi(page, '/api/projects', {
        method: 'POST',
        data: {
          name: strangerName,
          type: 'worker',
          code: 'export default { async fetch() { return new Response("stranger"); } };',
          filename: 'worker.js',
          bindings: { kv: [], d1: [], r2: [] },
          envVars: {}
        }
      });
      expect(stranger.ok, stranger.text).toBe(true);
      strangerId = stranger.data.id;

      // Default state: only the intentionally bound project references the resource.
      let projects = await browserApi(page, '/api/projects');
      expect(projects.ok, projects.text).toBe(true);
      let ownerProject = projects.data.find(item => item.id === ownerId);
      let strangerProject = projects.data.find(item => item.id === strangerId);
      expect(ownerProject.bindings.kv.some(item => item.resourceId === resourceId)).toBe(true);
      expect(strangerProject.bindings.kv.some(item => item.resourceId === resourceId)).toBe(false);

      // Single-admin platforms may explicitly rebind resources; that must remain an intentional PATCH,
      // not silent leakage from project creation defaults.
      const steal = await browserApi(page, `/api/projects/${strangerId}`, {
        method: 'PATCH',
        data: {
          bindings: { kv: [{ varName: 'CACHE', resourceId }], d1: [], r2: [] }
        }
      });
      expect(steal.ok, steal.text).toBe(true);
      projects = await browserApi(page, '/api/projects');
      strangerProject = projects.data.find(item => item.id === strangerId);
      expect(strangerProject.bindings.kv.some(item => item.resourceId === resourceId)).toBe(true);

      // Build lockfile policy: bare npm install without package-lock must fail closed.
      const noLockBuild = await browserSse(page, `/api/projects/${ownerId}/rebuild`, {
        data: { buildCommand: 'npm install', outputDir: '' }
      });
      expect(noLockBuild.ok).toBe(false);
      expect(String(noLockBuild.error?.content || noLockBuild.text)).toMatch(/package-lock\.json|lockfile|命令验证失败|Build failed|package\.json/i);

      // Dashboard ops summary cards are visible for dense console workflows.
      await page.goto('/');
      await expect(page.getByText(/失败部署|Failed deployments/)).toBeVisible();
      await expect(page.getByText(/3天内清理|Trash expiring in 3 days/)).toBeVisible();
    } finally {
      if (strangerId) await browserApi(page, `/api/projects/${strangerId}`, { method: 'DELETE' });
      if (ownerId) await browserApi(page, `/api/projects/${ownerId}`, { method: 'DELETE' });
      if (resourceId) {
        await browserApi(page, `/api/resources/kv/${resourceId}`, { method: 'DELETE' });
        await browserApi(page, `/api/trash/${resourceId}`, { method: 'DELETE' });
      }
    }
  });


});
