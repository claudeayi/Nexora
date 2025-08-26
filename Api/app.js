// api/app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// --- optionnels (pas bloquants si non installés) ---
function optionalRequire(name, fallback) {
  try { return require(name); } catch { return fallback; }
}
const compression = optionalRequire("compression", () => (req, _res, next) => next());
let rateLimit = null;
try { rateLimit = require("express-rate-limit"); } catch { /* optional */ }

// ---------------------------------------------------

const app = express();

// Réseau / proxy (pour IP correctes via X-Forwarded-For)
app.set("trust proxy", 1);

// CORS : allowlist depuis CORS_ORIGIN (séparé par des virgules) ou *
const originCfg = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl / SSR
    if (originCfg.includes("*") || originCfg.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: "Authorization,Content-Type,x-tenant",
  credentials: false,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Sécurité HTTP
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // permet le chargement du SDK/pixel
}));

// Compression (si dispo)
app.use(compression());

// JSON body parser (limite raisonnable pour propriétés d’événements)
app.use(express.json({ limit: "1mb" }));

// Logger
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Rate limiting global (si paquet présent)
if (rateLimit) {
  app.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  }));
}

// X-Request-Id simple
app.use((req, res, next) => {
  const rid = req.headers["x-request-id"] || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  req.id = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// ----------------- Routes montées -----------------

// Auth / Tenants / Ressources de base
app.use("/auth", require("./routes/auth"));
app.use("/leads", require("./routes/leads"));
app.use("/links", require("./routes/links"));

// Roadmap UI : événements + pixel + SDK + SSE + notifications
app.use("/events", require("./routes/events"));

// A/B testing, billing, meta
app.use("/experiments", require("./routes/experiments"));
app.use("/billing", require("./routes/billing"));
app.use("/", require("./routes/meta"));

// Fallback legacy reports pour l’UI
app.use("/reports", require("./routes/reports"));

// Copilot (Full IA)
app.use("/copilot", require("./routes/copilot"));

// Marketplace (install/uninstall)
app.use("/marketplace", require("./routes/marketplace"));

// ----------------- Health & diagnostics -----------------
app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

// ----------------- Gestion d’erreurs -----------------

// JSON mal formé
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid_json" });
  }
  return next(err);
});

// 404 JSON
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: "not_found", path: req.originalUrl });
});

// Erreur serveur
app.use((err, req, res, _next) => {
  console.error("❌ Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal_error", requestId: req.id });
});

// ----------------- Boot -----------------
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`✅ Nexora API running on port ${PORT} [env=${process.env.NODE_ENV || "dev"}]`);
});

module.exports = app;
