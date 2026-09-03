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
  const health = await response.json();
  assert.equal(health.status, "ok");
  assert.equal(health.service, "HelpDesk");
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

test("every subject includes a recommended books section", async () => {
  const response = await fetch(`${baseUrl}/api/resources?type=book`);
  const data = await response.json();
  assert.equal(data.subjects.length, 7);
  assert.ok(data.subjects.every((subject) => subject.resources.length === 1));
  assert.ok(data.subjects.every((subject) => subject.resources[0].type === "book"));
});

test("library exposes fourteen branches including Biotechnology", async () => {
  const response = await fetch(`${baseUrl}/api/resources`);
  const data = await response.json();
  assert.equal(data.branches.length, 14);
  assert.equal(data.unitCollections.length, 7);
  assert.equal(data.unitCollections.reduce((total, subject) => total + subject.units.length, 0), 35);
  assert.ok(data.branches.some((branch) => branch.name === "Mechanical Engineering"));
  assert.ok(data.branches.some((branch) => branch.name === "Electrical Engineering"));
  assert.ok(data.branches.some((branch) => branch.name === "Biotechnology" && branch.group === "technology"));
  assert.equal(data.branches.filter((branch) => branch.group === "engineering").length, 6);
  assert.equal(data.branches.filter((branch) => branch.group === "technology").length, 8);
});

test("syllabus is grouped into four semester and branch folders", async () => {
  const response = await fetch(`${baseUrl}/api/resources`);
  const data = await response.json();
  assert.equal(data.syllabusFolders.length, 4);
  assert.equal(data.syllabusFolders[0].id, "semester-1-technology");
  assert.equal(data.syllabusFolders[0].syllabusIds.length, 7);
  assert.ok(data.syllabusFolders.slice(1).every((folder) => folder.syllabusIds.length === 0));
});

test("twenty separated unit PDFs remain linked", async () => {
  const response = await fetch(`${baseUrl}/api/resources`);
  const data = await response.json();
  const pdfUrls = data.unitCollections.flatMap((subject) =>
    subject.units.map((unit) => unit.pyqUrl).filter(Boolean)
  );
  assert.equal(pdfUrls.length, 20);
  assert.ok(pdfUrls.every((url) => url.startsWith("/resources/pyqs/") && url.endsWith(".pdf")));
});

test("unit PDF opens inline from the website", async () => {
  const response = await fetch(`${baseUrl}/resources/pyqs/engineering-chemistry/Engineering_Chemistry_Unit_1_PYQs.pdf`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.ok((await response.arrayBuffer()).byteLength > 1000);
});

test("spa fallback serves the website", async () => {
  const response = await fetch(`${baseUrl}/any-page`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>HelpDesk · HBTU<\/title>/);
  assert.match(html, /class="resource-browser"/);
  assert.match(html, /id="branch-list"/);
  assert.match(html, /id="subject-list"/);
  assert.match(html, /id="subject-syllabus"/);
  assert.ok(html.indexOf('id="syllabus"') < html.indexOf('id="resources"'));
  assert.doesNotMatch(html, /resource-grid|30 resources across all subjects/);
});

test("mobile navigation keeps branch and subject lists available", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.match(html, /id="branch-list"[\s\S]*Loading branches/);
  assert.match(html, /id="subject-list"[\s\S]*Loading subjects/);
  assert.doesNotMatch(html, /id="branch-select"|id="subject-select"/);
  assert.match(html, /<aside class="mobile-menu"[\s\S]*id="timer-ring"[\s\S]*id="task-form"[\s\S]*<\/aside>/);
  assert.doesNotMatch(html, /class="study-section/);
});

test("static resource fallback works and application assets cannot go stale", async () => {
  const fallback = await fetch(`${baseUrl}/resources.json`);
  const data = await fallback.json();
  assert.equal(fallback.status, 200);
  assert.equal(data.branches.length, 14);
  assert.match(fallback.headers.get("cache-control"), /no-store/);

  const script = await fetch(`${baseUrl}/app.js`);
  assert.match(script.headers.get("cache-control"), /no-store/);
  const scriptText = await script.text();
  assert.match(scriptText, /"\/resources\.json"/);
  assert.doesNotMatch(scriptText, /replaceAll|padStart|\?\?|\?\./);

  const styles = await fetch(`${baseUrl}/premium.css`);
  const styleText = await styles.text();
  assert.match(styleText, /touch-action: pan-y/);
  assert.match(styleText, /-webkit-overflow-scrolling: touch/);
  assert.match(styleText, /@keyframes subject-item-enter/);
  assert.match(styleText, /@keyframes unit-row-enter/);
  assert.match(scriptText, /animateBrowser\(changeType\)/);
  assert.match(scriptText, /prefersReducedMotion\(\)/);
  assert.match(scriptText, /renderSubjectSyllabus\(branch, subject\)/);
  assert.match(scriptText, /syllabusFolders/);
});

test("help section includes both supplied profiles and revealable WhatsApp contacts", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.match(html, /id="help"/);
  assert.match(html, /images\/akshat-shukla\.png/);
  assert.match(html, /images\/priyanshu-dixit\.png/);
  assert.match(html, /87870 16664/);
  assert.match(html, /wa\.me\/919305819589/);
  assert.match(html, /93058 19589/);

  const image = await fetch(`${baseUrl}/images/akshat-shukla.png`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
});
