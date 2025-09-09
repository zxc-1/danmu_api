# 使用官方 Node.js 18 轻量版镜像作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app/danmu_api

# 复制 package.json 和 package-lock.json（如果存在）
COPY danmu_api/package*.json ./

# 安装项目依赖
RUN npm install

# 复制所有源代码
COPY danmu_api/ .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]