// api/routes/copilot.js
const express = require("express");
const axios = require("axios");
const { prisma } = require("../lib/prisma");
const { auth } = require("../middlewares/auth");
const { resolveTenant } = require("../middlewares/tenant");
const { computeLeadScore } = require("../utils/scoring");

const router = express.Router();

// Supporte AI_URL (ton fichier) et AI_BASE_URL (autres modules)
const AI_BASE = process.env.AI_URL || process.env.AI_BASE_URL || "http://localhost:8000";

// Utilitaires
function toBool(v) { return !!v; }
function clamp01(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function dayKey(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).toISOString().slice(0, 10);
}
function zAnomalies(values, z = 2.5) {
  if (!Array.isArray(values) || values.length < 5) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const std = Math.max(Math.sqrt(variance), 1e-9);
  const idx = [];
  values.forEach((v, i) => { if (Math.abs((v - mean) / std) >= z) idx.push(i); });
  return idx;
}
function seriesFrom(rows, key = "createdAt", days = 7) {
  const now = new Date();
  const map = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(+now);
    d.setDate(now.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const label = new Date(r[key]).toISOString().slice(0, 10);
    if (map.has(label)) map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map, ([date, count]) => ({ date, count }));
}

// Auth facultative + multi-tenant obligatoire
router.use(auth(false), resolveTenant);

/**
 * 1) Lead scoring prédictif (IA) + fallback heuristique classique
 * POST /copilot/lead/score
 * body: { email, phone, utmSource, utmCampaign, engagement }
 */
router.post("/lead/score", async (req, res) => {
  try {
    const { email = "", phone = "", utmSource = "", utmCampaign = "", engagement = 0 } = req.body || {};
    const domain = (email.split("@")[1] || "").toLowerCase();
    const email_domain_corporate = !!(domain && !/(gmail|yahoo|outlook)\./i.test(domain));
    const has_phone = !!(phone && String(phone).replace(/\D/g, "").length >= 8);
    const utm_source_known = toBool(utmSource);
    const utm_campaign_pro = /pro|enterprise|b2b/i.test(utmCampaign);

    let ai;
    try {
      const { data } = await axios.post(`${AI_BASE}/predict/lead`, {
        email_domain_corporate,
        has_phone,
        utm_source_known,
        utm_campaign_pro,
        engagement_score: clamp01(engagement),
      });
      ai = data;
    } catch {
      // Fallback local si le microservice IA est indisponible
      const p = 0.45 + (email_domain_corporate ? 0.15 : 0) + (has_phone ? 0.1 : 0) + (utm_source_known ? 0.05 : 0) + (utm_campaign_pro ? 0.1 : 0);
      ai = { probability: Math.max(0.01, Math.min(0.95, p)), score: Math.round(Math.max(0.01, Math.min(0.95, p)) * 100) };
    }

    const classical = computeLeadScore({ email, phone, utmSource, utmCampaign });
    return res.json({ probability: ai.probability, score: ai.score ?? classical, classical });
  } catch (e) {
    console.error("lead/score", e.message);
    return res.status(500).json({ error: "lead_score_failed" });
  }
});

/**
 * 2) Suggestion de variante A/B (bandit IA) — crée A/B par défaut
 * GET /copilot/ab/suggest?experiment=cta-text
 */
router.get("/ab/suggest", async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const name = String(req.query.experiment || "cta-text");

    let exp = await prisma.experiment.findUnique({
      where: { name },
      include: { variants: true },
    });

    if (!exp) {
      exp = await prisma.experiment.create({
        data: {
          name,
          status: "active",
          variants: { create: [{ name: "A", weight: 50 }, { name: "B", weight: 50 }] },
        },
        include: { variants: true },
      });
    }

    const variants = exp.variants.map(v => ({
      name: v.name,
      views: v.views || 0,
      conversions: v.conversions || 0,
    }));

    let chosen = "A";
    try {
      const { data } = await axios.post(`${AI_BASE}/ab/select`, { variants });
      chosen = data?.variant || chosen;
    } catch {
      // Fallback: choisir la variante au meilleur ratio conv/visites
      let best = "A", bestRate = -1;
      for (const v of variants) {
        const rate = v.views > 0 ? v.conversions / v.views : 0;
        if (rate > bestRate) { bestRate = rate; best = v.name; }
      }
      chosen = best;
    }

    // (Optionnel) journaliser la reco côté tenant via ProofLedger
    try {
      await prisma.proofLedger.create({
        data: {
          data: { type: "ab_suggest", experiment: name, chosen, tenantId },
          hash: require("crypto").createHash("sha256").update(JSON.stringify({ name, chosen, tenantId, ts: Date.now() })).digest("hex"),
        },
      });
    } catch {}

    return res.json({ experiment: name, recommended: chosen });
  } catch (e) {
    console.error("ab/suggest", e.message);
    return res.status(500).json({ error: "ab_suggest_failed" });
  }
});

/**
 * 3) Génération de copies / landing (IA)
 * POST /copilot/generate
 * body: { product, audience, goal }
 */
router.post("/generate", async (req, res) => {
  try {
    const { product = "Nexora", audience = "PME", goal = "augmenter les conversions" } = req.body || {};
    try {
      const { data } = await axios.post(`${AI_BASE}/generate/copy`, { product, audience, goal });
      return res.json(data);
    } catch {
      // Fallback local minimal
      return res.json({
        headline: `${product} : votre copilote ${audience}`,
        subheadline: `Objectif : ${goal}. Démarrez en 2 minutes, optimisez automatiquement.`,
        bullets: [
          "Suivi temps réel + alertes IA",
          "A/B testing autonome (bandit)",
          "Leads qualifiés (scoring prédictif)",
          "Attribution omnicanale",
          "Tarification dynamique & anti-fraude",
        ],
        cta: "Essayer gratuitement",
      });
    }
  } catch (e) {
    console.error("generate", e.message);
    return res.status(500).json({ error: "generate_failed" });
  }
});

/**
 * 4) Alerts/anomalies sur la série d'événements (tenant-scoped)
 * GET /copilot/alerts
 */
router.get("/alerts", async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const evs = await prisma.event.findMany({
      where: { tenantId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    // agrège par jour
    const bucket = new Map();
    for (const e of evs) {
      const key = dayKey(e.createdAt);
      bucket.set(key, (bucket.get(key) || 0) + 1);
    }
    const keys = Array.from(bucket.keys()).sort();
    const series = keys.map(k => bucket.get(k));

    // IA → fallback z-score local
    let anomalies = [];
    try {
      const { data } = await axios.post(`${AI_BASE}/anomaly/events`, { values: series, z_thresh: 2.5 });
      anomalies = Array.isArray(data?.anomalies) ? data.anomalies : [];
    } catch {
      anomalies = zAnomalies(series, 2.5);
    }

    return res.json({ dates: keys, series, anomalies });
  } catch (e) {
    console.error("alerts", e.message);
    return res.status(500).json({ error: "alerts_failed" });
  }
});

/**
 * 5) Pricing IA (tarification dynamique simple)
 * GET /copilot/pricing/suggest?country=CM&currency=XAF&base=15
 */
router.get("/pricing/suggest", async (req, res) => {
  try {
    const currency = String(req.query.currency || "USD");
    const country = req.query.country ? String(req.query.country) : null;
    const base_monthly = req.query.base ? Number(req.query.base) : 19.0;

    try {
      const { data } = await axios.post(`${AI_BASE}/pricing/suggest`, { currency, country, base_monthly });
      return res.json(data);
    } catch {
      // Fallback PPP simple
      const factors = { US: 1.0, CA: 0.95, FR: 0.9, DE: 0.95, UK: 1.05, CM: 0.7, CI: 0.7, SN: 0.7, NG: 0.65, IN: 0.6 };
      const f = factors[(country || "US").toUpperCase()] ?? 0.9;
      const monthly = Math.round(base_monthly * f * 100) / 100;
      const annual = Math.round(monthly * 10 * 100) / 100;
      return res.json({ currency, country, monthly, annual, factor: f });
    }
  } catch (e) {
    console.error("pricing", e.message);
    return res.status(500).json({ error: "pricing_failed" });
  }
});

/**
 * 6) Overview narratif (tenant-scoped) + séries 7 jours
 * GET /copilot/overview
 */
router.get("/overview", async (req, res) => {
  try {
    const tenantId = req.tenant.id;

    const [leadCount, clickCount, eventCount] = await Promise.all([
      prisma.lead.count({ where: { tenantId } }),
      prisma.click.count({ where: { tenantId } }),
      prisma.event.count({ where: { tenantId } }),
    ]);

    const since = new Date(); since.setDate(since.getDate() - 7);

    const [leads7, clicks7] = await Promise.all([
      prisma.lead.findMany({ where: { tenantId, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.click.findMany({ where: { tenantId, createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);

    const seriesLeads = seriesFrom(leads7);
    const seriesClicks = seriesFrom(clicks7);

    const trend = (arr) => (arr.length < 2 ? 0 : arr[arr.length - 1].count - arr[0].count);
    const tLead = trend(seriesLeads);
    const tClick = trend(seriesClicks);
    const narrative =
      `Sur 7 jours, ${leadCount} leads et ${clickCount} clics. ` +
      (tLead >= 0 ? `Leads en hausse de ${tLead}. ` : `Leads en baisse de ${-tLead}. `) +
      (tClick >= 0 ? `Clics en hausse de ${tClick}.` : `Clics en baisse de ${-tClick}.`);

    return res.json({ leadCount, clickCount, eventCount, seriesLeads, seriesClicks, narrative });
  } catch (e) {
    console.error("overview", e.message);
    return res.status(500).json({ error: "overview_failed" });
  }
});

module.exports = router;
