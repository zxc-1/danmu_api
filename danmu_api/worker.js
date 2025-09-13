// 全局状态（Cloudflare 和 Vercel 都可能重用实例）
// ⚠️ 不是持久化存储，每次冷启动会丢失
let animes = [];
let episodeIds = [];
let episodeNum = 10001; // 全局变量，用于自增 ID

// 日志存储，最多保存 100 行
const logBuffer = [];
const MAX_LOGS = 100;
const MAX_ANIMES = 100;
const allowedPlatforms = ["qiyi", "bilibili1", "imgo", "youku", "qq"];

const DEFAULT_TOKEN = "87654321"; // 默认 token
let token = DEFAULT_TOKEN;

// 这里既支持 Cloudflare env，也支持 Node process.env
function resolveToken(env) {
  if (env && env.TOKEN) return env.TOKEN;         // Cloudflare Workers
  if (typeof process !== "undefined" && process.env?.TOKEN) return process.env.TOKEN; // Vercel / Node
  return DEFAULT_TOKEN;
}

// 添加元素到 episodeIds：检查 url 是否存在，若不存在则以自增 id 添加
function addEpisode(url, title) {
    // 检查是否已存在相同的 url
    const exists = episodeIds.some(episode => episode.url === url);
    if (exists) {
        console.log(`URL ${url} already exists in episodeIds, skipping addition.`);
        return null; // 返回 null 表示未添加
    }

    // 自增 episodeNum 并使用作为 id
    episodeNum++;
    const newEpisode = { id: episodeNum, url: url, title: title };

    // 添加新对象
    episodeIds.push(newEpisode);
    console.log(`Added to episodeIds: ${JSON.stringify(newEpisode)}`);
    return newEpisode; // 返回新添加的对象
}

// 删除指定 URL 的对象从 episodeIds
function removeEpisodeByUrl(url) {
    const initialLength = episodeIds.length;
    episodeIds = episodeIds.filter(episode => episode.url !== url);
    const removedCount = initialLength - episodeIds.length;
    if (removedCount > 0) {
        console.log(`Removed ${removedCount} episode(s) from episodeIds with URL: ${url}`);
        return true;
    }
    console.log(`No episode found in episodeIds with URL: ${url}`);
    return false;
}

// 根据 ID 查找 URL
function findUrlById(id) {
    const episode = episodeIds.find(episode => episode.id === id);
    if (episode) {
        console.log(`Found URL for ID ${id}: ${episode.url}`);
        return episode.url;
    }
    console.log(`No URL found for ID: ${id}`);
    return null;
}

// 添加 anime 对象到 animes，并将其 links 添加到 episodeIds
function addAnime(anime) {
    // 确保 anime 有 links 属性且是数组
    if (!anime.links || !Array.isArray(anime.links)) {
        console.log(`Invalid or missing links in anime: ${JSON.stringify(anime)}`);
        return false;
    }

    // 创建 anime 的副本以避免修改原始对象
    const animeCopy = { ...anime, links: [] }; // 初始化 links 为空数组

    // 遍历 links，调用 addEpisode，并收集返回的对象
    const newLinks = [];
    anime.links.forEach(link => {
        if (link.url) {
            const episode = addEpisode(link.url, link.title);
            if (episode) {
                newLinks.push(episode); // 仅添加成功添加的 episode
            }
        } else {
            console.log(`Invalid link in anime, missing url: ${JSON.stringify(link)}`);
        }
    });

    // 替换 animeCopy 的 links
    animeCopy.links = newLinks;

    // 添加到 animes
    animes.push(animeCopy);
    console.log(`Added anime: ${JSON.stringify(animeCopy)}`);

    // 检查是否超过 MAX_ANIMES，超过则删除最早的
    if (animes.length > MAX_ANIMES) {
        removeEarliestAnime();
    }

    return true;
}

// 删除最早添加的 anime，并从 episodeIds 删除其 links 中的 url
function removeEarliestAnime() {
    if (animes.length === 0) {
        console.log("No animes to remove.");
        return false;
    }

    // 移除最早的 anime（第一个元素）
    const removedAnime = animes.shift();
    console.log(`Removed earliest anime: ${JSON.stringify(removedAnime)}`);

    // 从 episodeIds 删除该 anime 的所有 links 中的 url
    if (removedAnime.links && Array.isArray(removedAnime.links)) {
        removedAnime.links.forEach(link => {
            if (link.url) {
                removeEpisodeByUrl(link.url);
            }
        });
    }

    return true;
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
    if ('rows' in data.data.longData) {
      animes = data.data.longData.rows;
    }

    log("log", `360kan animes.length: ${animes.length}`);

    return animes;
  } catch (error) {
    log("error", `get360Animes error: ${error.message}`);
    throw error;
  }
}

// 查询360kan综艺详情
async function get360Zongyi(entId, site, year) {
  try {
    let links = [];
    for (let j = 0; j <= 10; j++) {
      const response = await fetch(
          `https://api.so.360kan.com/episodeszongyi?entid=${entId}&site=${site}&y=${year}&count=20&offset=${j * 20}`,
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
      log("log", "360kan zongyi response:", data);

      // 检查API返回状态
      if (data.msg !== "ok") {
        throw new Error(data.errorMessage || "API调用失败");
      }

      const episodeList = data.data.list;
      if (!episodeList) {
        break;
      }
      for (const episodeInfo of episodeList) {
        links.push({"name": episodeInfo.id, "url": episodeInfo.url, "title": `【${site}】${episodeInfo.name}(${episodeInfo.period})`});
      }

      log("log", `links.length: ${links.length}`);
    }
    return links;
  } catch (error) {
    log("error", `get360Animes error: ${error.message}`);
    throw error;
  }
}

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
  let curAnimes = [];
  const queryTitle = url.searchParams.get("keyword");
  log("log", `Search anime with keyword: ${queryTitle}`);

  // 查询360
  const animes360 = await get360Animes(queryTitle);
  for (const anime of animes360) {
    let links = [];
    if (anime.cat_name === "电影") {
      for (const key in Object.keys(anime.playlinks)) {
        if (allowedPlatforms.includes(key)) {
          links.push({"name": key, "url": anime.playlinks[key], "title": `【${key}】${anime.titleTxt}(${anime.year})`});
        }
      }
    } else if (anime.cat_name === "电视剧" || anime.cat_name === "动漫") {
      for (let i = 0; i < anime.seriesPlaylinks.length; i++) {
        const item = anime.seriesPlaylinks[i];
        links.push({"name": i+1, "url": item.url, "title": `【${anime.seriesSite}】${anime.titleTxt}(${anime.year})`});
      }
    } else if (anime.cat_name === "综艺") {
      for (const site of Object.keys(anime.playlinks_year)) {
        for (const year of anime.playlinks_year[site]) {
          const subLinks = await get360Zongyi(anime.id, site, year);
          links = links.concat(subLinks);
        }
      }
    }

    let transformedAnime = {
      animeId: anime.id, // Mapping animeId to id
      bangumiId: anime.id, // Mapping bangumiId to id
      animeTitle: `${anime.titleTxt}(${anime.year})【${anime.cat_name}】`, // Mapping animeTitle to titleTxt
      type: anime.cat_name, // Mapping type to cat_name
      typeDescription: anime.cat_name, // Mapping typeDescription to cat_name
      imageUrl: anime.cover, // Mapping imageUrl to cover
      startDate: `${anime.year}-01-01T00:00:00.000Z`, // Start date to the year field in ISO format
      episodeCount: links.length, // Mapping episodeCount to length of seriesPlaylinks
      rating: 0, // Default rating as 0
      isFavorited: true, // Assuming all anime are favorited by default
    };

    curAnimes.push(transformedAnime);
    // Check if the anime already exists in the animes array
    const exists = animes.some(existingAnime => existingAnime.animeId === transformedAnime.animeId);
    if (!exists) {
      const transformedAnimeCopy = { ...transformedAnime, links: links };
      addAnime(transformedAnimeCopy);
    }
    if (animes.length > MAX_ANIMES) {
      removeEarliestAnime();
    }
  }

  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    animes: curAnimes,
  });
}

// Extracted function for GET /api/v2/bangumi/:animeId
async function getBangumi(path) {
  const animeId = parseInt(path.split("/").pop());
  const anime = animes.find((a) => a.animeId.toString() === animeId.toString());
  if (!anime) {
    log("error", `Anime with ID ${animeId} not found`);
    return jsonResponse(
      { errorCode: 404, success: false, errorMessage: "Anime not found", bangumi: null },
      404
    );
  }
  log("log", `Fetched details for anime ID: ${animeId}`);

  let resData = {
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
      episodes: [],
    },
  };

  for (let i = 0; i < anime.links.length; i++) {
    const link = anime.links[i];
    resData["bangumi"]["episodes"].push({
          seasonId: `season-${anime.animeId}`,
          episodeId: link.id,
          episodeTitle: `${link.title}`,
          episodeNumber: link.id.toString(),
          airDate: anime.startDate,
        });
  }

  return jsonResponse(resData);
}

// Extracted function for GET /api/v2/comment/:commentId
async function getComment(path) {
  const commentId = parseInt(path.split("/").pop());
  const url = findUrlById(commentId);
  if (!url) {
    log("error", `Comment with ID ${commentId} not found`);
    return jsonResponse({ count: 0, comments: [] }, 404);
  }
  log("log", `Fetched comment ID: ${commentId}`);
  return jsonResponse({ count: 1, comments: [url] });
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

  if (path === "/favicon.ico" || path === "/robots.txt") {
    return new Response(null, { status: 204 });
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

  const response = await handleRequest(cfReq, process.env);

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const text = await response.text();
  res.send(text);
}

// 为了测试导出 handleRequest
export { handleRequest };