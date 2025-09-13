// 全局状态（Cloudflare 和 Vercel 都可能重用实例）
// ⚠️ 不是持久化存储，每次冷启动会丢失
let animes = [];
let episodeIds = [];
let episodeNum = 10001; // 全局变量，用于自增 ID

// 日志存储，最多保存 500 行
const logBuffer = [];
const MAX_LOGS = 500;
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
        log("log", `URL ${url} already exists in episodeIds, skipping addition.`);
        return null; // 返回 null 表示未添加
    }

    // 自增 episodeNum 并使用作为 id
    episodeNum++;
    const newEpisode = { id: episodeNum, url: url, title: title };

    // 添加新对象
    episodeIds.push(newEpisode);
    log("log", `Added to episodeIds: ${JSON.stringify(newEpisode)}`);
    return newEpisode; // 返回新添加的对象
}

// 删除指定 URL 的对象从 episodeIds
function removeEpisodeByUrl(url) {
    const initialLength = episodeIds.length;
    episodeIds = episodeIds.filter(episode => episode.url !== url);
    const removedCount = initialLength - episodeIds.length;
    if (removedCount > 0) {
        log("log", `Removed ${removedCount} episode(s) from episodeIds with URL: ${url}`);
        return true;
    }
    log("error", `No episode found in episodeIds with URL: ${url}`);
    return false;
}

// 根据 ID 查找 URL
function findUrlById(id) {
    const episode = episodeIds.find(episode => episode.id === id);
    if (episode) {
        log("log", `Found URL for ID ${id}: ${episode.url}`);
        return episode.url;
    }
    log("error", `No URL found for ID: ${id}`);
    return null;
}

// 添加 anime 对象到 animes，并将其 links 添加到 episodeIds
function addAnime(anime) {
    // 确保 anime 有 links 属性且是数组
    if (!anime.links || !Array.isArray(anime.links)) {
        log("error", `Invalid or missing links in anime: ${JSON.stringify(anime)}`);
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
            log("error", `Invalid link in anime, missing url: ${JSON.stringify(link)}`);
        }
    });

    // 替换 animeCopy 的 links
    animeCopy.links = newLinks;

    // 添加到 animes
    animes.push(animeCopy);
    log("log", `Added anime: ${JSON.stringify(animeCopy)}`);

    // 检查是否超过 MAX_ANIMES，超过则删除最早的
    if (animes.length > MAX_ANIMES) {
        removeEarliestAnime();
    }

    return true;
}

// 删除最早添加的 anime，并从 episodeIds 删除其 links 中的 url
function removeEarliestAnime() {
    if (animes.length === 0) {
        log("error", "No animes to remove.");
        return false;
    }

    // 移除最早的 anime（第一个元素）
    const removedAnime = animes.shift();
    log("log", `Removed earliest anime: ${JSON.stringify(removedAnime)}`);

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

// =====================
// 请求工具方法
// =====================

async function httpGet(url, options) {
  log("log", `[iOS模拟] HTTP GET: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...options.headers,
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let data;

    if (options.base64Data) {
      log("log", "base64模式");

      // 先拿二进制
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 转换为 Base64
      let binary = '';
      const chunkSize = 0x8000; // 分块防止大文件卡死
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        let chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      data = btoa(binary); // 得到 base64 字符串

    } else if (options.zlibMode) {
      log("log", "zlib模式")

      data = await response.arrayBuffer();

      // 使用 zlib 解压数据
      const buffer = Buffer.from(data);  // 将二进制数据转成 Buffer（Node.js 中使用）

      let decompressedData;
      try {
        decompressedData = zlib.inflateSync(buffer); // 使用同步的 inflate 解压数据
      } catch (e) {
        log("error", "[iOS模拟] 解压缩失败", e);
        throw e;
      }

      // 将解压的数据转回字符串
      const decodedData = decompressedData.toString('utf-8');
      data = decodedData;  // 更新解压后的数据
    } else {
      data = await response.text();
    }

    let parsedData;
    try {
      parsedData = JSON.parse(data);  // 尝试将文本解析为 JSON
    } catch (e) {
      parsedData = data;  // 如果解析失败，保留原始文本
    }

    // 获取所有 headers，但特别处理 set-cookie
    const headers = {};
    let setCookieValues = [];

    // 遍历 headers 条目
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        setCookieValues.push(value);
      } else {
        headers[key] = value;
      }
    }

    // 如果存在 set-cookie 头，将其合并为分号分隔的字符串
    if (setCookieValues.length > 0) {
      headers['set-cookie'] = setCookieValues.join(';');
    }
    // 模拟 iOS 环境：返回 { data: ... } 结构
    return {
      data: parsedData,
      status: response.status,
      headers: headers
    };

  } catch (error) {
    log("error", `[iOS模拟] 请求失败:`, error.message);
    throw error;
  }
}

async function httpPost(url, body, options = {}) {
  log("log", `[iOS模拟] HTTP POST: ${url}`);

  // 处理请求头、body 和其他参数
  const { headers = {}, params, allow_redirects = true } = options;
  const fetchOptions = {
    method: 'POST',
    headers: {
      ...headers,
    },
    body: body
  };

  if (!allow_redirects) {
    fetchOptions.redirect = 'manual';  // 禁止重定向
  }

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(data);  // 尝试将文本解析为 JSON
    } catch (e) {
      parsedData = data;  // 如果解析失败，保留原始文本
    }

    // 模拟 iOS 环境：返回 { data: ... } 结构
    return {
      data: parsedData,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };

  } catch (error) {
    log("error", `[iOS模拟] 请求失败:`, error.message);
    throw error;
  }
}

// =====================
// 获取播放链接
// =====================

// 查询360kan影片信息
async function get360Animes(title) {
  try {
    const response = await httpGet(
      `https://api.so.360kan.com/index?force_v=1&kw=${encodeURIComponent(title)}&from=&pageno=1&v_ap=1&tab=all`,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    const data = response.data;
    log("log", "360kan response:", data);

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
      const response = await httpGet(
          `https://api.so.360kan.com/episodeszongyi?entid=${entId}&site=${site}&y=${year}&count=20&offset=${j * 20}`,
          {
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
          }
      );

      const data = await response.data;
      log("log", "360kan zongyi response:", data);

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

// =====================
// 工具方法
// =====================

function printFirst200Chars(data) {
  let dataToPrint;

  if (typeof data === 'string') {
    dataToPrint = data;  // 如果是字符串，直接使用
  } else if (Array.isArray(data)) {
    dataToPrint = JSON.stringify(data);  // 如果是数组，转为字符串
  } else if (typeof data === 'object') {
    dataToPrint = JSON.stringify(data);  // 如果是对象，转为字符串
  } else {
    log("error", "Unsupported data type");
    return;
  }

  log("log", dataToPrint.slice(0, 200));  // 打印前200个字符
}

function convertToDanmakuXML(contents) {
  let danmus = []
  for (const content of contents) {
    const attributes = [
      content.timepoint,
      content.ct,
      content.size,
      content.color,
      content.unixtime,
      '0',
      content.uid,
      '26732601000067074',
      '1'
    ].join(',');
    danmus.push({
      p: attributes,
      m: content.content
    });
  }
  log("log", "danmus:", danmus.length);
  return danmus;
}

// =====================
// 获取腾讯弹幕
// =====================

async function fetchTencentVideo(inputUrl) {
  log("log", "开始从本地请求腾讯视频弹幕...", inputUrl);

  // 弹幕 API 基础地址
  const api_danmaku_base = "https://dm.video.qq.com/barrage/base/";
  const api_danmaku_segment = "https://dm.video.qq.com/barrage/segment/";

  // 解析 URL 获取 vid
  let vid;
  // 1. 尝试从查询参数中提取 vid
  const queryMatch = inputUrl.match(/[?&]vid=([^&]+)/);
  if (queryMatch) {
    vid = queryMatch[1]; // 获取 vid 参数值
  } else {
    // 2. 从路径末尾提取 vid
    const pathParts = inputUrl.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    vid = lastPart.split('.')[0]; // 去除文件扩展名
  }

  log("log", "vid:", vid);

  // 获取页面标题
  let res;
  try {
    res = await httpGet(inputUrl, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
  } catch (error) {
    log("error", "请求页面失败:", error);
    return null;
  }

  // 使用正则表达式提取 <title> 标签内容
  const titleMatch = res.data.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].split("_")[0] : "未知标题";
  log("log", "标题:", title);

  // 获取弹幕基础数据
  try {
    res = await httpGet(api_danmaku_base + vid, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    log("error", "请求弹幕基础数据失败:", error);
    return null;
  }

  // 先把 res.data 转成 JSON
  const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;

  // 获取弹幕分段数据
  const promises = [];
  const segmentList = Object.values(data.segment_index);
  for (const item of segmentList) {
    promises.push(
      httpGet(`${api_danmaku_segment}${vid}/${item.segment_name}`, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      })
    );
  }

  log("log", "弹幕分段数量:", promises.length);

  // 解析弹幕数据
  let contents = [];
  try {
    const results = await Promise.allSettled(promises);
    const datas = results
      .filter(result => result.status === "fulfilled")
      .map(result => result.value.data);

    for (let data of datas) {
      data = typeof data === "string" ? JSON.parse(data) : data;
      for (const item of data.barrage_list) {
        const content = {
            timepoint: 0,	// 弹幕发送时间（秒）
            ct: 1,	// 弹幕类型，1-3 为滚动弹幕、4 为底部、5 为顶端、6 为逆向、7 为精确、8 为高级
            size: 25,	//字体大小，25 为中，18 为小
            color: 16777215,	//弹幕颜色，RGB 颜色转为十进制后的值，16777215 为白色
            unixtime: Math.floor(Date.now() / 1000),	//Unix 时间戳格式
            uid: 0,		//发送人的 id
            content: "",
        };
        content.timepoint = item.time_offset / 1000;
        if (item.content_style?.color) {
          log("log", "弹幕颜色:", JSON.stringify(item.content_style.color));
        }
        content.content = item.content;
        contents.push(content);
      }
    }
  } catch (error) {
    log("error", "解析弹幕数据失败:", error);
    return null;
  }

  printFirst200Chars(contents);

  // 返回结果
  return convertToDanmakuXML(contents);
}

// =====================
// 路由请求相关
// =====================

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
        links.push({"name": i+1, "url": item.url, "title": `【${anime.seriesSite}】${anime.titleTxt}(${anime.year}) ${i+1}`});
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

  log("log", "开始从本地请求弹幕...", url);
  let danmus = [];
  if (url.includes('.qq.com')) {
      danmus = await fetchTencentVideo(url);
  }
  // if (url.includes('.iqiyi.com')) {
  //     return await fetchIqiyi(url);
  // }
  // if (url.includes('.mgtv.com')) {
  //     return await fetchMangoTV(url);
  // }
  // if (url.includes('.bilibili.com')) {
  //     return await fetchBilibili(url);
  // }
  // if (url.includes('.youku.com')) {
  //     return await fetchYouku(url);
  // }
  return jsonResponse({ count: danmus.length, comments: danmus });
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
      message: "Welcome to the MuMu Danmu API server",
      repository: "https://github.com/huangxd-/danmu_api.git",
      description: "一个人人都能部署的基于 js 的弹幕 API 服务器，兼容弹弹play的搜索、详情查询和弹幕获取功能，并提供日志记录，支持vercel/cloudflare/docker/claw等部署方式",
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
export { handleRequest, fetchTencentVideo };