# LogVar 弹幕 API 服务器

一个人人都能部署的基于 js 的弹幕 API 服务器，兼容弹弹play的搜索、详情查询和弹幕获取功能，并提供日志记录，支持vercel/cloudflare/docker/claw等部署方式。

## 功能
- **API 接口**：
  - `GET /api/v2/search/anime?keyword=${queryTitle}`：根据关键字搜索动漫。
  - `GET /api/v2/bangumi/:animeId`：获取指定动漫的详细信息。
  - `GET /api/v2/comment/:commentId?withRelated=true&chConvert=1`：获取指定弹幕评论，支持返回相关评论和字符转换。
  - `GET /api/logs`：获取最近的日志（最多 500 行，格式为 `[时间戳] 级别: 消息`）。
- **日志记录**：捕获 `console.log`（info 级别）和 `console.error`（error 级别），JSON 内容格式化输出。
- **部署支持**：支持本地运行、Docker 容器化、Vercel 一键部署、Cloudflare 一键部署和 Docker 一键启动。

## 前置条件
- Node.js（v18 或更高版本）
- npm
- Docker（可选，用于容器化部署）

## 本地运行
1. **克隆仓库**：
   ```bash
   git clone <仓库地址>
   cd <项目目录>
   ```

2. **安装依赖**：
   ```bash
   npm install
   ```

3. **启动服务器**：
   ```bash
   npm start
   ```
   服务器将在 `http://{ip}:9321` 运行。
   或者使用下面的命令
   ```bash
   # 启动
   node ./danmu_api/server.js
   # 测试
   node --test ./danmu_api/worker.test.js
   ```

4. **测试 API**：
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
   docker run -d -p 9321:9321 --name danmu-api -e TOKEN=your_token_here danmu-api-server
   ```
   - 使用`-e TOKEN=your_token_here`设置`TOKEN`环境变量，覆盖Dockerfile中的默认值。

3. **测试 API**：
   使用 `http://{ip}:9321` 访问上述 API 接口。

## Docker 一键启动
1. **拉取镜像**：
   ```bash
   docker pull logvar/danmu-api:0.0.1
   ```

2. **运行容器**：
   ```bash
   docker run -d -p 9321:9321 --name danmu-api -e TOKEN=your_token_here logvar/danmu-api:0.0.1
   ```
   - 使用`-e TOKEN=your_token_here`设置`TOKEN`环境变量。

3. **测试 API**：
   使用 `http://{ip}:9321` 访问上述 API 接口。

## 部署到 Vercel

### 一键部署
点击以下按钮即可将项目快速部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/huangxd-/danmu_api&project-name=danmu_api&repository-name=danmu_api)

**注意**：请将按钮链接中的 `https://github.com/huangxd-/danmu_api` 替换为你的实际 Git 仓库地址。编辑 `README.md` 并更新链接后，推送到仓库，点击按钮即可自动克隆和部署。
- **设置环境变量**：部署后，在 Vercel 仪表板中：
  1. 转到你的项目设置。
  2. 在“Environment Variables”部分添加 `TOKEN` 变量，输入你的 API 令牌值。
  3. 保存更改并重新部署。

## 部署到 Cloudflare

### 一键部署
点击以下按钮即可将项目快速部署到 Cloudflare：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/huangxd-/danmu_api)

**注意**：请将按钮链接中的 `https://github.com/huangxd-/danmu_api` 替换为你的实际 Git 仓库地址。编辑 `README.md` 并更新链接后，推送到仓库，点击按钮即可自动克隆和部署。
- **设置环境变量**：部署后，在 Cloudflare 仪表板中：
  1. 转到你的 Workers 项目。
  2. 转到“Settings” > “Variables”。
  3. 添加 `TOKEN` 环境变量，输入你的 API 令牌值。
  4. 保存并部署。

### 手动部署
创建一个worker，并将danmu_api/worker.js里的代码直接拷贝到你创建的worker.js里，并点击部署。

## 项目结构
```
danmu_api/
├── .github/
│   └── workflows/
│       └── docker-image.yml
├── danmu_api/
│   ├── README.md       # 项目文档
│   ├── server.js       # 本地node启动脚本
│   ├── worker.js       # 主 API 服务器代码
│   ├── worker.test.js  # 测试文件
├── .gitignore
├── Dockerfile
├── package.json
├── vercel.json
```

## 注意事项
- 日志存储在内存中，服务器重启后会清空。
- `/api/logs` 中的 JSON 日志会格式化显示，带缩进以提高可读性。
- 确保 `package.json` 中包含 `node-fetch` 依赖。
- 一键部署需要将项目推送到公开的 Git 仓库（如 GitHub），并更新按钮中的仓库地址。
- 运行 Docker 容器时，需通过 `-e TOKEN=your_token_here` 传递 `TOKEN` 环境变量。

## 许可证
MIT