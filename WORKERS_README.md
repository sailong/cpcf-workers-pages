Cloudflare Workers 创建与资源绑定全流程
这个流程分为三个主要阶段：初始化部署、资源准备、绑定与配置。

第一阶段：创建并初步部署 Worker
目标：建立一个最基础的 Worker 实例并使其在线。

步骤 1：创建 Worker 服务
登录 Cloudflare Dashboard。

在左侧菜单栏点击 Workers & Pages -> Overview。

点击蓝色的 Create Application 按钮。

点击 Create Worker 按钮。

步骤 2：定义名称与初始代码
Name your Worker：输入你的 Worker 名称（例如 my-api-worker）。这将成为默认子域名的一部分（如 my-api-worker.你的用户名.workers.dev）。

Code Preview：右侧会显示默认的 Hello World 代码。你可以暂时不改动，或者直接粘贴你准备好的简单 JS 代码。

注：如果你有现成的文件需要上传，这通常是在部署后的编辑界面操作，或者使用 CLI 工具。此处建议先使用默认代码。

点击底部的 Deploy 按钮。

步骤 3：验证初步部署
页面会提示 "Congratulations! Your Worker is deployed"。

点击提供的 Preview URL 链接，确保浏览器能显示 "Hello World" 或你的代码输出。

点击 Edit code 按钮，进入在线编辑器界面。在这里你可以进行代码的编写、调试或上传文件。

第二阶段：准备后端资源 (D1 & KV)
在将数据库绑定到 Worker 之前，你必须先创建这些资源。

步骤 4：创建 KV Namespace (键值存储)
回到 Dashboard 左侧菜单，点击 Workers & Pages -> KV。

点击 Create a namespace。

Namespace Name：输入名称（例如 MY_APP_CONFIG）。

点击 Add。记录下生成的 ID（虽然绑定时通常只需要选名字）。

步骤 5：创建 D1 Database (SQL 数据库)
点击左侧菜单 Workers & Pages -> D1 SQL Database。

点击 Create database。

选择 Create database (Standard)。

Database name：输入名称（例如 my-users-db）。

点击 Create。

第三阶段：配置环境变量与资源绑定
这是最关键的一步，将代码中的变量名与实际的云端资源连接起来。

步骤 6：进入配置页面
回到 Workers & Pages -> Overview。

点击你刚才创建的 Worker 名称（my-api-worker）。

在顶部标签页中，点击 Settings (设置)。

在左侧子菜单点击 Variables (变量)。

步骤 7：配置环境变量 (Environment Variables)
用于存放 API Key、Secret 等明文或加密文本。

找到 Environment Variables 区域，点击 Add variable。

Variable name: 输入代码中引用的变量名 (例如 API_TOKEN)。

Value: 输入具体的值。

(可选) 点击 Encrypt 按钮将其加密（一旦保存无法查看明文，只能重置）。

点击 Save and deploy。

步骤 8：绑定 KV Namespace
向下滚动找到 KV Namespace Bindings 区域。

点击 Add binding。

Variable name: 输入代码中调用的对象名 (例如 MY_KV)。这是你在 JS 代码中 env.MY_KV.get() 使用的名字。

KV Namespace: 在下拉菜单中选择你在“步骤 4”中创建的 MY_APP_CONFIG。

点击 Save and deploy。

步骤 9：绑定 D1 Database
向下滚动找到 D1 Database Bindings 区域。

点击 Add binding。

Variable name: 输入代码中调用的对象名 (例如 DB)。这是你在 JS 代码中 env.DB.prepare() 使用的名字。

D1 Database: 在下拉菜单中选择你在“步骤 5”中创建的 my-users-db。

点击 Save and deploy。

第四阶段：在代码中调用配置
绑定完成后，你需要更新代码来使用这些绑定的资源。

步骤 10：修改代码并发布
回到 Worker 页面，点击 Code 标签页或右上角的 Quick Edit。

修改你的 worker.js 或 index.js，参考以下结构调用刚才绑定的资源：

JavaScript
export default {
  async fetch(request, env, ctx) {
    // 1. 使用环境变量
    const token = env.API_TOKEN;

    // 2. 使用 KV 存储 (读取 key 为 "welcome_msg" 的值)
    const kvMessage = await env.MY_KV.get("welcome_msg");

    // 3. 使用 D1 数据库 (查询 User 表)
    // 注意：需要先在 D1 控制台创建表
    const { results } = await env.DB.prepare("SELECT * FROM users LIMIT 1").all();

    return new Response(JSON.stringify({
      token_status: token ? "Loaded" : "Missing",
      kv_message: kvMessage,
      db_result: results
    }), {
      headers: { "content-type": "application/json" }
    });
  },
};
点击右上角的 Save and deploy 完成最终发布。