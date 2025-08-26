// api/src/lib/prisma.js
const { PrismaClient } = require("@prisma/client");

/**
 * Configuration des logs Prisma via .env :
 *  - PRISMA_LOG_QUERY=true    -> log des requêtes SQL
 *  - PRISMA_LOG_INFO=true     -> infos
 *  - PRISMA_LOG_WARN=true     -> warnings
 *  - PRISMA_LOG_ERROR=true    -> erreurs
 */
function buildLogConfig() {
  const logs = [];
  if (String(process.env.PRISMA_LOG_QUERY || "").toLowerCase() === "true")
    logs.push({ emit: "event", level: "query" });
  if (String(process.env.PRISMA_LOG_INFO || "").toLowerCase() === "true")
    logs.push({ emit: "stdout", level: "info" });
  if (String(process.env.PRISMA_LOG_WARN || "true").toLowerCase() === "true")
    logs.push({ emit: "stdout", level: "warn" });
  if (String(process.env.PRISMA_LOG_ERROR || "true").toLowerCase() === "true")
    logs.push({ emit: "stdout", level: "error" });
  return logs;
}

/**
 * En dev, on garde une instance globale pour éviter la multiplication des connexions
 * lors des hot-reloads (Vite/Nodemon).
 */
const globalForPrisma = globalThis;
let prisma = globalForPrisma.__NEXORA_PRISMA__;

if (!prisma) {
  prisma = new PrismaClient({
    log: buildLogConfig(),
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });

  // Logs optionnels des requêtes (si PRISMA_LOG_QUERY=true)
  prisma.$on?.("query", (e) => {
    // Masque sommaire pour éviter d'exposer des secrets dans les logs
    const q = (e.query || "").replace(/password\s*=\s*'.*?'/gi, "password='***'");
    console.log(`\n[Prisma:query] ${q}\nParams: ${e.params}\nDuration: ${e.duration}ms`);
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__NEXORA_PRISMA__ = prisma;
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.error("[Prisma] disconnect error:", err?.message || err);
    } finally {
      if (signal) process.exit(0);
    }
  };

  process.on("beforeExit", () => shutdown());
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

/**
 * Ping rapide pour healthcheck DB.
 * @returns {Promise<boolean>}
 */
async function prismaHealthcheck() {
  try {
    // Requête légère ; sur MySQL on peut faire SELECT 1 via $queryRaw
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.error("[Prisma] healthcheck failed:", e?.message || e);
    return false;
  }
}

/**
 * Helper transaction :
 * @param {(tx: PrismaClient) => Promise<any>} fn
 */
async function withTransaction(fn, opts = {}) {
  return prisma.$transaction(async (tx) => fn(tx), opts);
}

module.exports = {
  prisma,
  prismaHealthcheck,
  withTransaction,
};
