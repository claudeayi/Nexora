const express = require("express");
const axios = require("axios");
const { prisma } = require("../lib/prisma");

const router = express.Router();
const AI_URL = process.env.AI_URL || "http://localhost:8000";

// 1) Lead scoring prédictif (IA)
router.post("/lead/score", async (req, res) => {
  try {
    const { email = "", phone = "", utmSource = "", utmCampaign = "", engagement = 0 } = req.body || {};
    const domain = (email.split("@")[1] || "").toLowerCase();
    const email_domain_corporate = !!(domain && !/(gmail|yahoo|outlook)\./i.test(domain));
    const has_phone = !!(phone && String(phone).replace(/\D/g, "").length >= 8);
    const utm_source_known = !!utmSource;
    const utm_campaign_pro = /pro|enterprise|b2b/i.test(utmCampaign);

    const { data } = await axios.post(`${AI_URL}/predict/lead`, {
      email_domain_corporate,
      has_phone,
      utm_source_known,
      utm_campaign_pro,
      engagement_score: Math.max(0, Math.min(1, Number(engagement) || 0))
    });
    res.json({ ...data });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "lead_score_failed" });
  }
});

// 2) Suggestion de variante A/B (bandit IA)
router.get("/ab/suggest", async (req, res) => {
  try {
    const name = String(req.query.experiment || "cta-text");
    let exp = await prisma.experiment.findUnique({ where: { name }, include: { variants: true } });
    if (!exp) {
      exp = await prisma.experiment.create({
        data: { name, status: "active", variants: { create: [{ name: "A" }, { name: "B" }] } },
        include: { variants: true }
      });
    }
    const variants = exp.variants.map(v => ({ name: v.name, views: v.views || 0, conversions: v.conversions || 0 }));
    const { data } = await axios.post(`${AI_URL}/ab/select`, { variants });
    res.json({ experiment: name, recommended: data.variant });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "ab_suggest_failed" });
  }
});

// 3) Génération de copies / landing (IA)
router.post("/generate", async (req, res) => {
  try {
    const { product = "Nexora", audience = "PME", goal = "augmenter les conversions" } = req.body || {};
    const { data } = await axios.post(`${AI_URL}/generate/copy`, { product, audience, goal });
    res.json(data);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "generate_failed" });
  }
});

// 4) Alerts/anomalies sur la série d'événements
router.get("/alerts", async (_req, res) => {
  try {
    // dernière fenêtre 30 jours
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const evs = await prisma.event.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    });
    // agrège par jour
    const map = new Map();
    for (const e of evs) {
      const d = new Date(e.createdAt);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    }
    const series = Array.from(map.keys()).sort().map(k => map.get(k));
    const { data } = await axios.post(`${AI_URL}/anomaly/events`, { values: series, z_thresh: 2.5 });
    res.json({ series, anomalies: data.anomalies });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "alerts_failed" });
  }
});

// 5) Pricing IA (tarification dynamique simple)
router.get("/pricing/suggest", async (req, res) => {
  try {
    const currency = String(req.query.currency || "USD");
    const country = req.query.country ? String(req.query.country) : null;
    const base_monthly = req.query.base ? Number(req.query.base) : 19.0;
    const { data } = await axios.post(`${AI_URL}/pricing/suggest`, { currency, country, base_monthly });
    res.json(data);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "pricing_failed" });
  }
});

// 6) Overview narratif (résumé IA local simple)
router.get("/overview", async (_req, res) => {
  try {
    const [leadCount, clickCount, eventCount] = await Promise.all([
      prisma.lead.count(),
      prisma.click.count(),
      prisma.event.count()
    ]);
    const narrative = `Semaine en progression : ${leadCount} leads, ${clickCount} clics, ${eventCount} événements. 
    Recommandation: activer l'A/B sur le CTA, renforcer LinkedIn si >30% des leads proviennent du social, et déployer une landing dédiée au segment le plus chaud.`;
    res.json({ leadCount, clickCount, eventCount, narrative });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "overview_failed" });
  }
});

module.exports = router;
