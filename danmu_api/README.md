# 简单 Node.js API 服务器

一个基于 Node.js 和 Express 的简单 API 服务器，支持弹弹play的动漫搜索、详情查询和弹幕评论功能，以及日志记录。

## 功能
- **API 接口**：
  - `GET /api/v2/search/anime?keyword=${queryTitle}`：根据关键字搜索动漫。
  - `GET /api/v2/bangumi/:animeId`：获取指定动漫的详细信息。
  - `GET /api/v2/comment/:commentId?withRelated=true&chConvert=1`：获取指定弹幕评论，支持返回相关评论和字符转换。
  - `GET /api/logs`：获取最近的日志（最多 500 行，格式为 `[时间戳] 级别: 消息`）。
- **日志记录**：捕获 `console.log`（info 级别）和 `console.error`（error 级别），JSON 内容格式化输出。
- **部署支持**：支持本地运行、Docker 容器化和 Vercel 部署。

## 前置条件
- Node.js（v18 或更高版本）
- npm
- Docker（可选，用于容器化部署）
- Vercel CLI（用于手动 Vercel 部署）

## 本地运行
1. **克隆仓库**：
   ```bash
   git clone <仓库地址>
   cd <项目目录>
   ```

2. **进入 danmu_api 目录**：
   ```bash
   cd danmu_api
   ```

3. **安装依赖**：
   ```bash
   npm install
   ```

4. **启动服务器**：
   ```bash
   npm start
   ```
   服务器将在 `http://{ip}:9321` 运行。

5. **测试 API**：
   使用 Postman 或 curl 测试：
   - `GET http://{ip}:9321/api/v2/search/anime?keyword=Anime%20A`
   - `GET http://{ip}:9321/api/v2/bangumi/1`
   - `GET http://{ip}:9321/api/v2/comment/1?withRelated=true&chConvert=1`
   - `GET http://{ip}:9321/api/logs`

## 使用 Docker 运行
1. **构建 Docker 镜像**：
   ```bash
   docker build -t danmu-api-server .
   ```

2. **运行容器**：
   ```bash
   docker run -p 9321:9321 danmu-api-server
   ```

3. **测试 API**：
   使用 `http://{ip}:9321` 访问上述 API 接口。

## 部署到 Vercel

### 一键部署
点击以下按钮即可将项目快速部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/huangxd-/danmu_api&project-name=danmu_api&repository-name=danmu_api)

**注意**：请将按钮链接中的 `https://github.com/your-username/simple-api-server` 替换为你的实际 Git 仓库地址（例如 `https://github.com/your-username/your-repo`）。编辑 `danmu_api/README.md` 并更新链接后，推送到仓库，点击按钮即可自动克隆和部署。

### 手动部署
1. **安装 Vercel CLI**：
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**：
   ```bash
   vercel login
   ```

3. **部署项目**：
   在项目根目录运行：
   ```bash
   vercel
   ```
   - 按提示操作：
     - 确认部署（输入 `y`）。
     - 选择你的 Vercel 账户或团队（scope）。
     - 项目根目录选择 `./`（包含 `danmu_api` 子目录）。
     - 保留默认设置，除非需要特定更改。
   - Vercel 会自动检测 `danmu_api/server.js` 和 `danmu_api/vercel.json` 并完成部署。

4. **验证部署**：
   部署完成后，Vercel 会提供一个 URL（例如 `https://your-project.vercel.app`）。使用此 URL 测试 API：
   - `GET https://your-project.vercel.app/api/v2/search/anime?keyword=Anime%20A`
   - `GET https://your-project.vercel.app/api/v2/bangumi/1`
   - `GET https://your-project.vercel.app/api/v2/comment/1?withRelated=true&chConvert=1`
   - `GET https://your-project.vercel.app/api/logs`

## 项目结构
```
├── danmu_api/
│   ├── server.js       # 主 API 服务器代码
│   ├── package.json    # 项目依赖和脚本
│   ├── Dockerfile      # Docker 配置
│   ├── vercel.json     # Vercel 部署配置
│   ├── README.md       # 项目文档
```

## 注意事项
- 日志存储在内存中，服务器重启后会清空。
- `/api/logs` 中的 JSON 日志会格式化显示，带缩进以提高可读性。
- 确保 `danmu_api/package.json` 中包含 `express` 依赖。
- 一键部署需要将项目推送到公开的 Git 仓库（如 GitHub），并更新按钮中的仓库地址。

## 许可证
MIT