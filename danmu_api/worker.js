// 全局状态（Cloudflare 和 Vercel 都可能重用实例）
// ⚠️ 不是持久化存储，每次冷启动会丢失
let animes = [
  {
    animeId: 1,
    bangumiId: "bgm001",
    animeTitle: "Anime A",
    type: "tvseries",
    typeDescription: "TV Series",
    imageUrl: "https://example.com/anime-a.jpg",
    startDate: "2025-01-01T00:00:00.000Z",
    episodeCount: 12,
    rating: 8.5,
    isFavorited: true,
  },
  {
    animeId: 2,
    bangumiId: "bgm002",
    animeTitle: "Anime B",
    type: "tvseries",
    typeDescription: "TV Series",
    imageUrl: "https://example.com/anime-b.jpg",
    startDate: "2025-02-01T00:00:00.000Z",
    episodeCount: 24,
    rating: 7.8,
    isFavorited: false,
  },
];

const comments = [
  { cid: 1, p: "00:01.500,1,25,16777215,1694208000", m: "Great episode!" },
  { cid: 2, p: "00:02.000,1,25,16777215,1694208001", m: "Love this anime!" },
];

const DEFAULT_TOKEN = "87654321"; // 默认 token
let token = DEFAULT_TOKEN;

// 这里既支持 Cloudflare env，也支持 Node process.env
function resolveToken(env) {
  if (env && env.TOKEN) return env.TOKEN;         // Cloudflare Workers
  if (typeof process !== "undefined" && process.env?.TOKEN) return process.env.TOKEN; // Vercel / Node
  return DEFAULT_TOKEN;
}

// 查询360kan影片信息
async function get360Animes(title) {
  try {
    const response = await fetch(
      `https://api.so.360kan.com/index?force_v=1&kw=${encodeURIComponent(title)}&from=&pageno=1&v_ap=1&tab=all`,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const data = await response.json();
    log("log", "360kan response:", data);

    // 检查API返回状态
    if (data.msg !== "ok") {
      throw new Error(data.errorMessage || "API调用失败");
    }

    let animes = [];
    if (data.data.longData.length !== 0) {
      animes = data.data.longData.rows;
    }

    log("log", `animes.length: ${animes.length}`);

    return animes;
  } catch (error) {
    log("error", `get360Animes error: ${error.message}`);
    throw error;
  }
}

// 日志存储，最多保存 500 行
const logBuffer = [];
const MAX_LOGS = 500;

function log(level, ...args) {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
    .join(" ");
  const timestamp = new Date().toISOString();
  logBuffer.push({ timestamp, level, message });
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  console[level](...args);
}

function formatLogMessage(message) {
  try {
    const parsed = JSON.parse(message);
    return JSON.stringify(parsed, null, 2).replace(/\n/g, "\n    ");
  } catch {
    return message;
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Extracted function for GET /api/v2/search/anime
async function searchAnime(url) {
  const queryTitle = url.searchParams.get("keyword");
  log("log", `Search anime with keyword: ${queryTitle}`);
  const animes360 = await get360Animes(queryTitle);
  animes360.forEach(anime => {
    const transformedAnime = {
      animeId: anime.id, // Mapping animeId to id
      bangumiId: anime.id, // Mapping bangumiId to id
      animeTitle: anime.titleTxt, // Mapping animeTitle to titleTxt
      type: anime.cat_name, // Mapping type to cat_name
      typeDescription: anime.cat_name, // Mapping typeDescription to cat_name
      imageUrl: anime.cover, // Mapping imageUrl to cover
      startDate: `${anime.year}-01-01T00:00:00.000Z`, // Start date to the year field in ISO format
      episodeCount: anime.seriesPlaylinks.length, // Mapping episodeCount to length of seriesPlaylinks
      rating: 0, // Default rating as 0
      isFavorited: true, // Assuming all anime are favorited by default
    };

    animes.push(transformedAnime);
  });
  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    animes: animes,
  });
}

// Extracted function for GET /api/v2/bangumi/:animeId
async function getBangumi(path) {
  const animeId = parseInt(path.split("/").pop());
  const anime = animes.find((a) => a.animeId === animeId);
  if (!anime) {
    log("error", `Anime with ID ${animeId} not found`);
    return jsonResponse(
      { errorCode: 404, success: false, errorMessage: "Anime not found", bangumi: null },
      404
    );
  }
  log("log", `Fetched details for anime ID: ${animeId}`);
  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    bangumi: {
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      animeTitle: anime.animeTitle,
      imageUrl: anime.imageUrl,
      isOnAir: true,
      airDay: 1,
      isFavorited: anime.isFavorited,
      rating: anime.rating,
      type: anime.type,
      typeDescription: anime.typeDescription,
      seasons: [
        {
          id: `season-${anime.animeId}`,
          airDate: anime.startDate,
          name: "Season 1",
          episodeCount: anime.episodeCount,
        },
      ],
      episodes: [
        {
          seasonId: `season-${anime.animeId}`,
          episodeId: 1,
          episodeTitle: "Episode 1",
          episodeNumber: "01",
          airDate: anime.startDate,
        },
      ],
    },
  });
}

// Extracted function for GET /api/v2/comment/:commentId
async function getComment(path) {
  const commentId = parseInt(path.split("/").pop());
  const comment = comments.find((c) => c.cid === commentId);
  if (!comment) {
    log("error", `Comment with ID ${commentId} not found`);
    return jsonResponse({ count: 0, comments: [] }, 404);
  }
  log("log", `Fetched comment ID: ${commentId}`);
  return jsonResponse({ count: 1, comments: [comment] });
}

async function handleRequest(req, env) {
  token = resolveToken(env);  // 每次请求动态获取，确保热更新环境变量后也能生效

  const url = new URL(req.url);
  let path = url.pathname;
  const method = req.method;

  // GET /
  if (path === "/" && method === "GET") {
    log("log", "Accessed homepage with repository information");
    return jsonResponse({
      message: "Welcome to the Danmu API server",
      repository: "https://github.com/huangxd-/danmu_api.git",
      notice: "本项目仅为个人爱好开发，代码开源。如有任何侵权行为，请联系本人删除。"
    });
  }

  // --- 校验 token ---
  const parts = path.split("/").filter(Boolean); // 去掉空段
  if (parts.length < 2 || parts[0] !== token) {
    log("error", `Invalid or missing token in path: ${path}`);
    return jsonResponse(
      { errorCode: 401, success: false, errorMessage: "Unauthorized" },
      401
    );
  }
  // 移除 token 部分，剩下的才是真正的路径
  path = "/" + parts.slice(1).join("/");

  // GET /api/v2/search/anime
  if (path === "/api/v2/search/anime" && method === "GET") {
    return searchAnime(url);
  }

  // GET /api/v2/bangumi/:animeId
  if (path.startsWith("/api/v2/bangumi/") && method === "GET") {
    return getBangumi(path);
  }

  // GET /api/v2/comment/:commentId
  if (path.startsWith("/api/v2/comment/") && method === "GET") {
    return getComment(path);
  }

  // GET /api/logs
  if (path === "/api/logs" && method === "GET") {
    const logText = logBuffer
      .map(
        (log) =>
          `[${log.timestamp}] ${log.level}: ${formatLogMessage(log.message)}`
      )
      .join("\n");
    return new Response(logText, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return jsonResponse({ message: "Not found" }, 404);
}

// --- Cloudflare Workers 入口 ---
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};

// --- Vercel 入口 ---
export async function vercelHandler(req, res) {
  const cfReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body:
      req.method === "POST" || req.method === "PUT"
        ? JSON.stringify(req.body)
        : undefined,
  });

  const response = await handleRequest(cfReq);

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const text = await response.text();
  res.send(text);
}

// 为了测试导出 handleRequest
export { handleRequest };