📂 方式二：直接上传部署 (手动)
适用于不使用 Git 版本控制，或者只想快速测试一个静态文件夹的场景。

在 Create Application 页面，不要点击 "Connect to Git"，而是点击下方的链接 Upload Assets。

输入 Project Name，点击 Create project。

上传文件：将本地包含 index.html 的文件夹直接拖拽到上传区域。

点击 Deploy Site。

⚙️ 基础配置：域名与访问控制
1. 绑定自定义域名 (Custom Domains)
进入 Pages 项目主页，点击 Custom Domains 标签。

点击 Set up a custom domain。

输入您的域名（如 blog.example.com），点击 Continue。

Cloudflare DNS 用户：系统会自动添加记录，点击 Activate domain 即可。

外部 DNS 用户：需在您的域名注册商处添加一条 CNAME 记录，指向 your-project.pages.dev。

2. 访问策略 (Access Policy)
场景：测试环境不想公开，或只允许特定人员访问。

进入 Settings > Access Policy。

点击 Enable Access Policy。

配置规则（例如：仅允许特定邮箱后缀，或通过 GitHub Organization 登录）。

🔧 高级配置：环境变量与后端绑定 (Functions)
如果您的 Pages 项目使用了 /functions 目录编写后端 API，或者使用了 Remix、Next.js 等全栈框架，需要配置以下内容。

1. 环境变量 (Environment Variables)
Pages 的环境变量分为两类，需分别配置：

位置：Settings > Environment variables

操作：

选择 Production (生产) 或 Preview (预览) 环境。

点击 Add variable。

输入变量名（如 API_KEY）和值。

加密：点击 Encrypt 按钮可加密敏感信息。

⚠️ 重要提示：修改环境变量后，必须触发一次新的部署（点击 Deployments > Retry deployment 或提交新代码）才会生效。

2. 绑定 D1 / KV / R2 资源
用于让 Pages Functions 访问 Cloudflare 的存储服务。

位置：Settings > Functions (注意：不是 Variables)

操作：

向下滚动找到对应的绑定区域（如 D1 Database Bindings）。

点击 Add binding。

Variable name：代码中调用的名称（如 DB）。

Namespace/Database：选择已创建好的资源。

点击 Save。

⚠️ 重要提示：新增或修改绑定后，同样需要重新部署才能在代码中生效。

特性,Workers (纯脚本),Pages (静态 + 全栈)
代码源,wrangler 上传或在线编辑,Git 仓库 (CI/CD)
构建方式,本地构建后上传,云端自动构建
环境变量位置,Settings > Variables,Settings > Environment variables
资源绑定位置,Settings > Variables,Settings > Functions
生效机制,保存即时生效,需重新部署 (Re-deploy) 后生效
适用场景,"API, 代理, 轻量级计算","博客, 文档, React/Vue 应用"