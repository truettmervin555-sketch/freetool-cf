# FreeTool-CF —— 纯 Cloudflare 栈免费图片工具

一个能直接 `wrangler deploy` 跑起来的 MVP，包含三个工具：

| 工具 | 实现方式 | 底层能力 |
|------|----------|----------|
| AI 去背景 | Worker + Images binding `segment=foreground` | BiRefNet（Workers AI 推理）|
| 图片 2x 放大 | Worker + Images binding `upscale=generate` | ESRGAN 超分 |
| 图片压缩 | 浏览器端 Canvas，**不上传** | 原生 API，零成本 |

整个站点 = 1 个 Cloudflare Worker + Workers Assets（托管前端）+ Images binding，无第三方依赖、无数据库、无后端服务器。

---

## 一、准备环境（只需一次）

1. 安装 [Node.js](https://nodejs.org/)（18+）。
2. 安装并登录 Wrangler（Cloudflare 命令行）：
   ```bash
   npm install -g wrangler
   wrangler login        # 浏览器授权，登录你的 CF 账号
   ```
3. 在 Cloudflare 控制台开启 **Images** 服务：
   - 进入 `Dashboard → Images`，点击「Create」/开启。
   - Images 是按量计费服务（按存储 + 变换次数），变换（去背景/放大）每次计费很少；
     具体额度与价格以 CF 定价页为准。免费额度随套餐变动，请自行核对。

## 二、部署（一条命令）

在本项目目录下执行：

```bash
wrangler deploy
```

部署成功后，终端会输出一个 `*.workers.dev` 测试域名，打开即可使用三个工具。

> 本地预览（可选）：`wrangler dev --remote`（加 `--remote` 才会调用真实的 Images 边缘服务）

## 三、绑定你自己的域名

你已经把域名加到了 Cloudflare，绑定只需两步：

1. 确认该域名的 DNS 由 Cloudflare 托管，且对应记录是**橙色云朵（已代理）**状态。
2. 进入 `Worker 详情 → Settings → Triggers → Custom Domains`，点「Add Custom Domain」，
   填入你的域名（例如 `img.yourdomain.com` 或 `tool.yourdomain.com`），按提示确认。
3. 等待证书下发（通常几十秒到几分钟），访问你的域名即可。

> 也可以走 `wrangler.toml` 的 `routes` 配置，但 Custom Domains 更简单、自动配 HTTPS，推荐新手用这种方式。

## 四、目录结构

```
freetool-cf/
├─ wrangler.jsonc        # 部署配置（Worker + Images binding + Assets）
├─ src/index.js          # Worker：/api/remove-bg、/api/upscale + 静态托管
├─ public/
│  ├─ index.html         # 前端页面（三个工具卡片）
│  ├─ style.css
│  └─ app.js             # 上传 / 调用 API / 浏览器端压缩
└─ README.md
```

## 五、常见问题

- **去背景/放大返回错误？** 确认 Images 已开启；图片需 ≤ 20MB；支持的输入格式含 PNG/JPEG/WebP/GIF/AVIF。
- **国内访问慢/打不开？** Cloudflare 免费版在中国大陆无优化节点，面向国内用户时建议前端改用国内 CDN，AI 推理仍可用 Cloudflare Workers（或换国内 GPU 服务）。
- **想加更多工具？** 在 `src/index.js` 加路由 + `public/app.js` 加调用即可，架构不变。
- **要防盗刷？** 可在 Worker 里加 Cloudflare Turnstile 或按 IP 限流（Durable Object），MVP 先未加。
