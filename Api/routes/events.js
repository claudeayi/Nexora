// api/routes/events.js
const express = require("express");
const { body, validationResult, query } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { ledgerHash } = require("../lib/util");
const { resolveTenant } = require("../middlewares/tenant");
const { push, list, subscribe } = require("../lib/notify");

const router = express.Router();

// Middleware multi-tenant (lit x-tenant, ?t=, ou "default")
router.use(resolveTenant);

// ------- Utilitaires -------
const hbMs = Number(process.env.SSE_HEARTBEAT_MS || 25_000);

const paginate = async (where, page, limit) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.event.count({ where }),
  ]);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
};

// ------- Créer un event -------
router.post(
  "/",
  body("name").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || null;
      const ua = req.headers["user-agent"] || null;
      const { name, properties, anonymousId, userId, url } = req.body || {};

      const ev = await prisma.event.create({
        data: {
          tenantId: req.tenant.id,
          name: String(name),
          properties: properties || {},
          anonymousId: anonymousId || null,
          userId: userId || null,
          ip,
          userAgent: ua,
          url: url || null,
        },
      });

      // Ledger (chaînage de hash)
      const prev = await prisma.proofLedger.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null);
      const hash = ledgerHash(prev?.hash || "", { type: "event", id: ev.id, tenant: req.tenant.key, name: ev.name });
      await prisma.proofLedger.create({
        data: { prevHash: prev?.hash || null, data: { type: "event", id: ev.id }, hash },
      });

      // Notification live (SSE)
      push(req.tenant.id, { title: "Événement", message: ev.name, eventId: ev.id });

      res.json({ event: ev });
    } catch (e) {
      console.error("events POST /", e);
      res.status(500).json({ error: "event_create_failed" });
    }
  }
);

// ------- Lister les events (pagination) -------
router.get(
  "/",
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  async (req, res) => {
    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      res.json(await paginate({ tenantId: req.tenant.id }, page, limit));
    } catch (e) {
      console.error("events GET /", e);
      res.status(500).json({ error: "event_list_failed" });
    }
  }
);

// ------- Notifications (fallback polling) -------
router.get("/notifications", (req, res) => {
  try {
    res.json(list(req.tenant.id));
  } catch (e) {
    console.error("events GET /notifications", e);
    res.status(500).json({ error: "notifications_failed" });
  }
});

// ------- SSE stream (temps réel UI) -------
router.get("/stream", async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const tenantId = req.tenant.id;

    // Envoi d'un court historique (chacun dans un message "data:")
    const hist = list(tenantId).slice(0, 10);
    for (const item of hist) res.write(`data: ${JSON.stringify(item)}\n\n`);

    const send = (msg) => res.write(`data: ${JSON.stringify(msg)}\n\n`);
    const unsubscribe = subscribe(tenantId, send);

    // Heartbeat pour éviter timeouts
    const t = setInterval(() => res.write(":\n\n"), hbMs);

    req.on("close", () => { clearInterval(t); unsubscribe(); });
  } catch (e) {
    console.error("events GET /stream", e);
    // on ne peut plus écrire si headers déjà envoyés — on ferme
    try { res.end(); } catch {}
  }
});

// ------- Pixel 1x1 (no-cache) -------
router.get("/pixel.gif", async (req, res) => {
  const PIXEL = Buffer.from("R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
  try {
    // Permet d'arriver sans header, depuis un site statique
    const key = (req.query.t || req.tenant?.key || "default").toString().toLowerCase();
    let tenant = await prisma.tenant.findUnique({ where: { key } });
    if (!tenant) tenant = await prisma.tenant.create({ data: { key, name: key.toUpperCase() } });

    const ev = await prisma.event.create({
      data: { tenantId: tenant.id, name: String(req.query.event || "pageview"), properties: req.query || {} },
    });

    const prev = await prisma.proofLedger.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null);
    const hash = ledgerHash(prev?.hash || "", { type: "pixel", id: ev.id, tenant: key });
    await prisma.proofLedger.create({ data: { prevHash: prev?.hash || null, data: { type: "pixel", id: ev.id }, hash } });

    // Notification live
    push(tenant.id, { title: "Pixel", message: `${req.query.event || "pageview"}`, eventId: ev.id });
  } catch (e) {
    console.error("events GET /pixel.gif", e);
  }
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store");
  res.send(PIXEL);
});

// ------- SDK embarquable -------
router.get("/sdk.js", (_req, res) => {
  const js = `
(function(){
  if (window.NEXORA_LOADED) return; window.NEXORA_LOADED = true;

  var API = window.NEXORA_API || '';
  var TENANT = window.NEXORA_TENANT || 'default';

  function post(path, payload){
    try {
      fetch(API + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant': TENANT
        },
        body: JSON.stringify(payload || {})
      });
    } catch(e){}
  }

  window.Nexora = {
    track: function(name, props){
      post('/events', { name: name, properties: props || {}, url: location.href });
    },
    lead: function(data){
      var u = new URL(location.href);
      var t = u.searchParams.get('t') || TENANT;
      fetch(API + '/leads?t=' + encodeURIComponent(t), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ landingPage: location.href }, data || {}))
      });
    }
  };

  // Pixel auto pageview
  var i = new Image();
  i.referrerPolicy = 'no-referrer-when-downgrade';
  i.src = API + '/events/pixel.gif?t=' + encodeURIComponent(TENANT) +
          '&event=pageview&url=' + encodeURIComponent(location.href);
})();`;
  res.set("Content-Type", "application/javascript; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.send(js);
});

module.exports = router;
