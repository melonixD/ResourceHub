const express = require("express");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const resourcesPath = path.join(__dirname, "data", "resources.json");

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: "32kb" }));
app.use(express.static(publicDir, { maxAge: "1h", etag: true }));

function loadResources() {
  return JSON.parse(fs.readFileSync(resourcesPath, "utf8"));
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "HBTU First Year Resource Hub" });
});

app.get("/api/resources", (req, res) => {
  const data = loadResources();
  const query = String(req.query.q || "").trim().toLowerCase();
  const type = String(req.query.type || "all").toLowerCase();
  const subject = String(req.query.subject || "all").toLowerCase();

  const subjects = data.subjects
    .filter((item) => subject === "all" || item.id === subject)
    .map((item) => ({
      ...item,
      resources: item.resources.filter((resource) => {
        const matchesType = type === "all" || resource.type === type;
        const haystack = `${item.name} ${item.shortName} ${resource.title} ${resource.description}`.toLowerCase();
        return matchesType && (!query || haystack.includes(query));
      }),
    }))
    .filter((item) => !query || item.resources.length > 0 || `${item.name} ${item.shortName}`.toLowerCase().includes(query));

  res.json({ ...data, subjects });
});

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`First Year Resource Hub running on port ${PORT}`);
  });
}

module.exports = app;
