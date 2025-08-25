// api/src/index.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
require("dotenv").config();

const app = express();

// Si tu es derrière Caddy/Nginx en prod
app.set("trust proxy", 1);

// CORS (accepte plusieurs origines séparées par des virgules)
const ALLOWED = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map(s => s.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED.includes("*") || ALLOWED.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant"],
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(compression());

// Helmet (assoupli pour dev; renforce en prod si besoin CSP)
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(morgan("dev"));

// --- Routes principales ---
app.use("/auth", require("./routes/auth"));
app.use("/leads", require("./routes/leads"));
app.use("/links", require("./routes/links"));
app.use("/events", require("./routes/events"));
app.use("/experiments", require("./routes/experiments"));
app.use("/billing", require("./routes/billing"));
app.use("/copilot", require("./routes/copilot")); // <= IA copilote
app.use("/", require("./routes/meta"));

// 404
app.use((req, res) => res.status(404).json({ error: "not_found" }));

// Handler d’erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "internal_error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`✅ Nexora API running on port ${PORT} (env: ${process.env.NODE_ENV || "development"})`)
);
