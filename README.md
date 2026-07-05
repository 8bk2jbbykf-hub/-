# 《研究生的一天》：《植物实验室生存指南》

一款可部署到 Cloudflare Pages 的原生 HTML/CSS/JavaScript 文字策略小游戏。玩家以游客模式进入，管理 30 天研究生生活：照顾植物、推进实验、读文献、写论文、应对导师和随机事件，并在结局后提交排行榜。

## 项目结构

```text
public/
  index.html
  style.css
  script.js
  _routes.json
functions/
  _shared.js
  api/
    health.js
    leaderboard.js
    me.js
    save.js
    auth/
      send-code.js
      verify-code.js
      logout.js
schema.sql
wrangler.toml
README.md
```

## 本地预览前端

直接打开 `public/index.html` 可以体验前端游戏、本地存档、导入导出等功能。排行榜提交和云端接口需要通过 Wrangler 启动 Pages Functions。

## 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

## 创建 D1 数据库

```bash
wrangler d1 create graduate-game-db
```

把命令输出里的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "graduate-game-db"
database_id = "填写你的 D1 database_id"
```

执行建表：

```bash
wrangler d1 execute graduate-game-db --file=./schema.sql
```

## 配置 Turnstile

1. 在 Cloudflare Dashboard 创建 Turnstile 站点，获得 site key 和 secret key。
2. 在 `public/script.js` 顶部把 `TURNSTILE_SITE_KEY` 的默认测试 key 替换为你的 site key，或在页面加载前设置 `window.TURNSTILE_SITE_KEY`。
3. 不要把 `TURNSTILE_SECRET_KEY` 写入前端代码或提交到仓库。
4. 设置后端 secret：

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

本地开发时可以在 `wrangler.toml` 中临时设置：

```toml
[vars]
MOCK_TURNSTILE = "true"
```

生产环境请保持 `MOCK_TURNSTILE = "false"`。

## 本地运行 Pages Functions

```bash
wrangler pages dev public --d1 DB=graduate-game-db
```

启动后测试：

```bash
curl http://localhost:8788/api/health
```

应返回：

```json
{
  "ok": true,
  "service": "graduate-game-api",
  "time": "ISO string"
}
```

## 部署到 Cloudflare Pages

1. 将项目推送到 Git 仓库。
2. 在 Cloudflare Pages 中创建项目并连接仓库。
3. 构建输出目录设置为 `public`。
4. 在 Pages 项目设置中绑定 D1 数据库，绑定名必须是 `DB`。
5. 在 Pages 环境变量中设置 `TURNSTILE_SECRET_KEY`。
6. 确认 `public/_routes.json` 存在，内容为：

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

7. 部署后访问 `/api/health` 检查 Functions 是否生效。
8. 完成一局游戏，使用 Turnstile 提交排行榜，确认 D1 中写入记录。

## API 概览

- `GET /api/health`：健康检查。
- `GET /api/leaderboard`：获取排行榜前 50 名，支持 `difficulty` 和 `topic` 筛选。
- `POST /api/leaderboard`：提交排行榜，校验 Turnstile、分数、昵称、结局、游戏摘要和频率限制。
- `POST /api/auth/send-code`：邮箱验证码登录预留接口。
- `POST /api/auth/verify-code`：验证码登录，设置 HttpOnly session cookie。
- `POST /api/auth/logout`：退出登录。
- `GET /api/me`：读取当前登录用户。
- `GET /api/save` / `POST /api/save`：登录后读取或上传云端存档。

## 常见错误排查

- D1 未绑定：确认 Pages 项目中的 D1 绑定名是 `DB`。
- Turnstile secret 未配置：确认设置了 `TURNSTILE_SECRET_KEY`，生产环境不能依赖 mock。
- `_routes.json` 放错目录：必须位于 `public/_routes.json`。
- API 路由文件命名错误：Pages Functions 路由依赖 `functions/api/...` 的文件路径。
- 本地 MOCK_TURNSTILE 设置问题：本地可以设为 `true`，部署前改回 `false`。
- 排行榜提交被拒绝：检查昵称长度、危险字符、分数和结局匹配关系，以及 60 秒频率限制。

## 安全说明

所有数据库查询都使用 D1 prepared statements。排行榜不会返回 email、guest_id 或 user_id。session token 只以 hash 形式保存到数据库。验证码只在 `MOCK_TURNSTILE=true` 的本地开发模式下返回，生产环境不会返回验证码。
