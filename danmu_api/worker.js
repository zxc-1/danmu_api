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
  if (!queryTitle) {
    log("error", { error: "Keyword is required", received: url.searchParams });
    return jsonResponse(
      {
        errorCode: 400,
        success: false,
        errorMessage: "Keyword is required",
        animes: [],
      },
      400
    );
  }
  const filteredAnimes = animes.filter((anime) =>
    anime.animeTitle.toLowerCase().includes(queryTitle.toLowerCase())
  );
  log("log", `Search anime with keyword: ${queryTitle}`);
  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    animes: filteredAnimes,
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

async function handleRequest(req) {
  const url = new URL(req.url);
  const path = url.pathname;
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
    return new Response(logText, { headers: { "Content-Type": "text/plain" } });
  }

  return jsonResponse({ message: "Not found" }, 404);
}

// --- Cloudflare Workers 入口 ---
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
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