const test = require('node:test');
const assert = require('node:assert').strict;
const { handleRequest, searchAnime, getBangumi, getComment, fetchTencentVideo, fetchIqiyi} = require('./worker');

// Mock Request class for testing
class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
  }
}

// Helper to parse JSON response
async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const urlPrefix = "http://localhost:9321";
const token = "87654321";

test('worker.js API endpoints', async (t) => {
  await t.test('GET / should return welcome message', async () => {
    const req = new MockRequest(urlPrefix, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(body.message, 'Welcome to the LogVar Danmu API server');
  });

  // await t.test('GET tencent danmu', async () => {
  //   const res = await fetchTencentVideo("http://v.qq.com/x/cover/rjae621myqca41h/j0032ubhl9s.html");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET iqiyi danmu', async () => {
  //   const res = await fetchIqiyi("https://www.iqiyi.com/v_1ftv9n1m3bg.html");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  await t.test('GET realistic danmu', async () => {
    // tencent
    // const keyword = "子夜归";
    // iqiyi
    const keyword = "赴山海";

    const searchUrl = new URL(`${urlPrefix}/${token}/api/v2/search/anime?keyword=${keyword}`);
    const searchRes = await searchAnime(searchUrl);
    const searchData = await searchRes.json();
    assert(searchData.animes.length > 0, `Expected searchData.animes.length > 0, but got ${searchData.animes.length}`);

    const bangumiUrl = new URL(`${urlPrefix}/${token}/api/v2/bangumi/${searchData.animes[0].animeId}`);
    const bangumiRes = await getBangumi(bangumiUrl.pathname);
    const bangumiData = await bangumiRes.json();
    assert(bangumiData.bangumi.episodes.length > 0, `Expected bangumiData.bangumi.episodes.length > 0, but got ${bangumiData.bangumi.episodes.length}`);

    const commentUrl = new URL(`${urlPrefix}/${token}/api/v2/comment/${bangumiData.bangumi.episodes[0].episodeId}?withRelated=true&chConvert=1`);
    const commentRes = await getComment(commentUrl.pathname);
    const commentData = await commentRes.json();
    assert(commentData.count > 0, `Expected commentData.count > 0, but got ${commentData.count}`);
  });
});