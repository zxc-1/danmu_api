const test = require('node:test');
const assert = require('node:assert').strict;
const { handleRequest, fetchTencentVideo} = require('./worker');

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

  await t.test('GET tencent danmu', async () => {
    const res = await fetchTencentVideo("http://v.qq.com/x/cover/rjae621myqca41h/j0032ubhl9s.html");
    assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  });
});