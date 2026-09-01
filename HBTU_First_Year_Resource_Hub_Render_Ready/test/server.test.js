const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../server");

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("health endpoint reports ok", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});

test("resource endpoint returns seven subjects", async () => {
  const response = await fetch(`${baseUrl}/api/resources`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.subjects.length, 7);
});

test("resource filters narrow results", async () => {
  const response = await fetch(`${baseUrl}/api/resources?subject=chemistry&type=lecture&q=spectroscopy`);
  const data = await response.json();
  assert.equal(data.subjects.length, 1);
  assert.equal(data.subjects[0].resources.length, 1);
  assert.equal(data.subjects[0].resources[0].id, "chem-spectroscopy");
});

test("spa fallback serves the website", async () => {
  const response = await fetch(`${baseUrl}/any-page`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Your first year/);
});
