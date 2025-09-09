const express = require('express');
const app = express();
const port = 9321;

// 模拟动漫数据
const animes = [
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
        isFavorited: true
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
        isFavorited: false
    }
];

// 模拟弹幕数据
const comments = [
    { cid: 1, p: "00:01.500,1,25,16777215,1694208000", m: "Great episode!" },
    { cid: 2, p: "00:02.000,1,25,16777215,1694208001", m: "Love this anime!" }
];

// 日志存储，最多保存 500 行
const logBuffer = [];
const MAX_LOGS = 500;

// 格式化日志消息，处理 JSON 字符串
function formatLogMessage(message) {
    try {
        // 尝试解析消息是否为 JSON
        const parsed = JSON.parse(message);
        // 如果是 JSON，格式化输出（带缩进）
        return JSON.stringify(parsed, null, 2).replace(/\n/g, '\n    ');
    } catch (e) {
        // 不是 JSON，直接返回原消息
        return message;
    }
}

// 重写 console.log 和 console.error 以捕获日志
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
    const logMessage = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    const timestamp = new Date().toISOString();
    logBuffer.push({ timestamp, level: 'info', message: logMessage });
    // 保持日志不超过 MAX_LOGS 行
    if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
    }
    originalConsoleLog.apply(console, args);
};

console.error = (...args) => {
    const logMessage = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    const timestamp = new Date().toISOString();
    logBuffer.push({ timestamp, level: 'error', message: logMessage });
    // 保持日志不超过 MAX_LOGS 行
    if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
    }
    originalConsoleError.apply(console, args);
};

// Middleware to parse JSON
app.use(express.json());

// 首页路由：返回开源仓库说明
app.get('/', (req, res) => {
    console.log('Accessed homepage with repository information');
    res.json({
        message: "Welcome to the Danmu API server",
        repository: "https://github.com/huangxd-/danmu_api.git",
        notice: "本项目仅为个人爱好开发，代码开源。如有任何侵权行为，请联系本人删除。"
    });
});

// API 1: 搜索动漫
app.get('/api/v2/search/anime', (req, res) => {
    const queryTitle = req.query.keyword;
    if (!queryTitle) {
        console.error({ error: 'Keyword is required', received: req.query });
        return res.status(400).json({
            errorCode: 400,
            success: false,
            errorMessage: "Keyword is required",
            animes: []
        });
    }
    const filteredAnimes = animes.filter(anime =>
        anime.animeTitle.toLowerCase().includes(queryTitle.toLowerCase())
    );
    console.log(`Search anime with keyword: ${queryTitle}`);
    res.json({
        errorCode: 0,
        success: true,
        errorMessage: "",
        animes: filteredAnimes
    });
});

// API 2: 获取动漫详情
app.get('/api/v2/bangumi/:animeId', (req, res) => {
    const animeId = parseInt(req.params.animeId);
    const anime = animes.find(a => a.animeId === animeId);
    if (!anime) {
        console.error(`Anime with ID ${animeId} not found`);
        return res.status(404).json({
            errorCode: 404,
            success: false,
            errorMessage: "Anime not found",
            bangumi: null
        });
    }
    console.log(`Fetched details for anime ID: ${animeId}`);
    res.json({
        errorCode: 0,
        success: true,
        errorMessage: "",
        bangumi: {
            animeId: anime.animeId,
            bangumiId: anime.bangumiId,
            animeTitle: anime.animeTitle,
            imageUrl: anime.imageUrl,
            searchKeyword: anime.animeTitle,
            isOnAir: true,
            airDay: 1,
            isFavorited: anime.isFavorited,
            isRestricted: false,
            rating: anime.rating,
            type: anime.type,
            typeDescription: anime.typeDescription,
            titles: [
                { language: "en", title: anime.animeTitle },
                { language: "ja", title: anime.animeTitle + " (JP)" }
            ],
            seasons: [
                {
                    id: `season-${anime.animeId}`,
                    airDate: anime.startDate,
                    name: "Season 1",
                    episodeCount: anime.episodeCount,
                    summary: `Summary for ${anime.animeTitle}`
                }
            ],
            episodes: [
                {
                    seasonId: `season-${anime.animeId}`,
                    episodeId: 1,
                    episodeTitle: "Episode 1",
                    episodeNumber: "01",
                    lastWatched: anime.startDate,
                    airDate: anime.startDate
                }
            ],
            summary: `Summary for ${anime.animeTitle}`,
            intro: `Introduction to ${anime.animeTitle}`,
            metadata: ["Genre: Action", "Studio: Studio A"],
            bangumiUrl: `https://example.com/bangumi/${anime.bangumiId}`,
            userRating: anime.rating,
            favoriteStatus: anime.isFavorited ? "favorited" : "none",
            comment: "",
            ratingDetails: {
                story: anime.rating,
                animation: anime.rating,
                music: anime.rating
            },
            relateds: animes.filter(a => a.animeId !== animeId).map(a => ({
                animeId: a.animeId,
                bangumiId: a.bangumiId,
                animeTitle: a.animeTitle,
                imageUrl: a.imageUrl,
                searchKeyword: a.animeTitle,
                isOnAir: true,
                airDay: 1,
                isFavorited: a.isFavorited,
                isRestricted: false,
                rating: a.rating
            })),
            similars: animes.filter(a => a.animeId !== animeId).map(a => ({
                animeId: a.animeId,
                bangumiId: a.bangumiId,
                animeTitle: a.animeTitle,
                imageUrl: a.imageUrl,
                searchKeyword: a.animeTitle,
                isOnAir: true,
                airDay: 1,
                isFavorited: a.isFavorited,
                isRestricted: false,
                rating: a.rating
            })),
            tags: [
                { id: 1, name: "Action", count: 100 },
                { id: 2, name: "Adventure", count: 80 }
            ],
            onlineDatabases: [
                { name: "Database A", url: "https://example.com/db/a" }
            ],
            trailers: [
                {
                    id: 1,
                    url: `https://example.com/trailer/${anime.animeId}`,
                    title: "Trailer 1",
                    imageUrl: `https://example.com/trailer-${anime.animeId}.jpg`,
                    date: anime.startDate
                }
            ]
        }
    });
});

// API 3: 获取弹幕评论
app.get('/api/v2/comment/:commentId', (req, res) => {
    const commentId = parseInt(req.params.commentId);
    const withRelated = req.query.withRelated === 'true';
    const chConvert = req.query.chConvert === '1';
    const comment = comments.find(c => c.cid === commentId);
    if (!comment) {
        console.error(`Comment with ID ${commentId} not found`);
        return res.status(404).json({
            count: 0,
            comments: []
        });
    }
    console.log(`Fetched comment ID: ${commentId}, withRelated: ${withRelated}, chConvert: ${chConvert}`);
    let resultComments = [comment];
    if (withRelated) {
        resultComments = comments; // 返回所有评论作为相关评论
    }
    if (chConvert) {
        resultComments = resultComments.map(c => ({
            ...c,
            m: c.m.toUpperCase() // 模拟字符转换
        }));
    }
    res.json({
        count: resultComments.length,
        comments: resultComments
    });
});

// API 4: 获取最近的日志（最多 500 行，纯文本格式）
app.get('/api/logs', (req, res) => {
    const logText = logBuffer
        .map(log => `[${log.timestamp}] ${log.level}: ${formatLogMessage(log.message)}`)
        .join('\n');
    res.set('Content-Type', 'text/plain');
    res.send(logText);
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});