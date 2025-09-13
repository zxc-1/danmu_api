const test = require('node:test');
const assert = require('node:assert').strict;
const { handleRequest } = require('./worker');

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
    assert.deepEqual(body, {
      message: 'Welcome to the Danmu API server',
      repository: 'https://github.com/huangxd-/danmu_api.git',
      notice: '本项目仅为个人爱好开发，代码开源。如有任何侵权行为，请联系本人删除。'
    });
  });

  await t.test('GET /api/v2/search/anime with valid keyword', async () => {
    const req = new MockRequest(`${urlPrefix}/${token}/api/v2/search/anime?keyword=Anime%20A`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.equal(body.errorCode, 0);
    assert.equal(body.success, true);
    assert.equal(body.errorMessage, '');
    assert.equal(body.animes.length, 1);
    assert.equal(body.animes[0].animeTitle, 'Anime A');
  });

  await t.test('GET /api/v2/search/anime without keyword', async () => {
    const req = new MockRequest(`${urlPrefix}/${token}/api/v2/search/anime`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 400);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.equal(body.errorCode, 400);
    assert.equal(body.success, false);
    assert.equal(body.errorMessage, 'Keyword is required');
    assert.deepEqual(body.animes, []);
  });

  await t.test('GET /api/v2/bangumi/1 should return anime details', async () => {
    const req = new MockRequest(`${urlPrefix}/${token}/api/v2/bangumi/1`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.equal(body.errorCode, 0);
    assert.equal(body.success, true);
    assert.equal(body.errorMessage, '');
    assert.equal(body.bangumi.animeId, 1);
    assert.equal(body.bangumi.animeTitle, 'Anime A');
    assert.equal(body.bangumi.seasons.length, 1);
    assert.equal(body.bangumi.episodes.length, 1);
  });

  await t.test('GET /api/v2/bangumi/999 should return 404', async () => {
    const req = new MockRequest(`${urlPrefix}/${token}/api/v2/bangumi/999`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 404);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.equal(body.errorCode, 404);
    assert.equal(body.success, false);
    assert.equal(body.errorMessage, 'Anime not found');
    assert.equal(body.bangumi, null);
  });

  await t.test('GET /api/v2/comment/1 should return comment', async () => {
    const req = new MockRequest(`${urlPrefix}/${token}/api/v2/comment/1`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.equal(body.count, 1);
    assert.equal(body.comments.length, 1);
    assert.equal(body.comments[0].cid, 1);
    assert.equal(body.comments[0].m, 'Great episode!');
  });

  await t.test('GET /api/v2/comment/999 should return 404', async () => {
    const req = new MockRequest(`${urlPrefix}/${token}/api/v2/comment/999`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 404);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.equal(body.count, 0);
    assert.deepEqual(body.comments, []);
  });

  await t.test('GET /api/logs should return logs as text', async () => {
    // Trigger a log by calling an endpoint
    const req = new MockRequest(`${urlPrefix}/${token}/api/v2/search/anime?keyword=Anime%20A`, { method: 'GET' });
    await handleRequest(req);

    const logReq = new MockRequest(`${urlPrefix}/${token}/api/logs`, { method: 'GET' });
    const res = await handleRequest(logReq);
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'text/plain');
    assert.match(body, /\[.*\] log: Search anime with keyword: Anime A/);
  });

  await t.test('Invalid path should return 404', async () => {
    const req = new MockRequest(`${urlPrefix}/${token}/invalid`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 404);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.equal(body.message, 'Not found');
  });
});