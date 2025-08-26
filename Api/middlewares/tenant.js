// api/middlewares/tenant.js
const { prisma } = require("../lib/prisma");

/**
 * ENV pris en charge:
 * - DEFAULT_TENANT_KEY: fallback (def. "default")
 * - TENANT_FROM_SUBDOMAIN: "1" pour activer l’extraction via sous-domaine
 * - BASE_DOMAIN: ex. "nexora.app" (utilisé pour sous-domaine)
 * - TENANT_CACHE_TTL: TTL du cache en secondes (def. 60)
 */

const DEFAULT_TENANT_KEY = (process.env.DEFAULT_TENANT_KEY || "default").toLowerCase();
const USE_SUBDOMAIN = (process.env.TENANT_FROM_SUBDOMAIN || "0") === "1";
const BASE_DOMAIN = process.env.BASE_DOMAIN || "";
const CACHE_TTL = Number(process.env.TENANT_CACHE_TTL || 60);

// Cache simple: key -> { tenant, exp }
const cache = new Map();

/* ----------------------- utilitaires ----------------------- */

function normalizeKey(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  // autorise a-z, 0-9 et tirets, longueur raisonnable
  if (!/^[a-z0-9-]{2,50}$/.test(key)) return null;
  return key;
}

function extractFromSubdomain(hostname) {
  try {
    if (!USE_SUBDOMAIN || !hostname) return null;
    const host = String(hostname).toLowerCase();
    // ex: tenant.nexora.app => "tenant"
    if (BASE_DOMAIN && host.endsWith(BASE_DOMAIN.toLowerCase())) {
      const left = host.slice(0, -BASE_DOMAIN.length).replace(/\.$/, "");
      // left peut contenir multi-niveaux: foo.bar -> on prend le plus à gauche
      const parts = left.split(".").filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
    }
    return null;
  } catch {
    return null;
  }
}

function pickTenantKey(req) {
  // 1) JWT
  if (req.user?.tenantKey) return req.user.tenantKey;
  // 2) header
  if (req.headers["x-tenant"]) return req.headers["x-tenant"];
  // 3) query
  if (req.query?.t) return req.query.t;
  // 4) sous-domaine (optionnel)
  const sd = extractFromSubdomain(req.hostname || req.headers.host);
  if (sd) return sd;
  // 5) fallback
  return DEFAULT_TENANT_KEY;
}

function getCached(key) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.tenant;
  if (hit) cache.delete(key);
  return null;
}

function setCached(key, tenant) {
  cache.set(key, { tenant, exp: Date.now() + CACHE_TTL * 1000 });
}

/* ------------------- accès Prisma + helpers ------------------- */

async function getTenantByKey(key) {
  const cached = getCached(key);
  if (cached) return cached;
  const t = await prisma.tenant.findUnique({ where: { key } });
  if (t) setCached(key, t);
  return t;
}

async function ensureTenantExists(key) {
  const existing = await getTenantByKey(key);
  if (existing) return existing;
  const created = await prisma.tenant.create({
    data: { key, name: key.toUpperCase() },
  });
  setCached(key, created);
  return created;
}

/**
 * Middleware principal
 * @param {object} options
 *  - required (bool): 404 si tenant introuvable (def. true)
 *  - createIfMissing (bool): créer automatiquement (def. true)
 */
function resolveTenant(options = {}) {
  const { required = true, createIfMissing = true } = options;

  return async (req, res, next) => {
    try {
      // 1) extraire
      const raw = pickTenantKey(req);
      const key = normalizeKey(raw);

      if (!key) {
        if (required) return res.status(400).json({ error: "invalid_tenant_key" });
        return next();
      }

      // 2) trouver/créer
      let tenant = await getTenantByKey(key);
      if (!tenant && createIfMissing) {
        tenant = await ensureTenantExists(key);
      }

      if (!tenant) {
        if (required) return res.status(404).json({ error: "tenant_not_found" });
        return next();
      }

      // 3) attacher au req/res
      req.tenant = tenant;
      req.tenantId = tenant.id;
      req.tenantKey = tenant.key;

      res.locals.tenant = tenant;
      res.locals.tenantId = tenant.id;
      res.locals.tenantKey = tenant.key;

      return next();
    } catch (e) {
      console.error("resolveTenant error:", e?.message || e);
      if (required) return res.status(500).json({ error: "tenant_resolve_failed" });
      return next();
    }
  };
}

/**
 * Guard léger si tu veux forcer la présence de tenant (au cas où)
 */
function requireTenant(req, res, next) {
  if (!req.tenant) return res.status(400).json({ error: "tenant_missing" });
  next();
}

module.exports = {
  resolveTenant,       // middleware configurable
  requireTenant,       // guard "hard"
  ensureTenantExists,  // helper pour scripts/admin
  getTenantByKey,      // helper read-only
};
