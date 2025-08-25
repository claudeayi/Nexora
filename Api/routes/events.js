const express = require("express");
const { body, validationResult, query } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { ledgerHash } = require("../lib/util");
const { resolveTenant } = require("../middlewares/tenant");

const router = express.Router();
router.use(resolveTenant);

const paginate = async (where, page, limit) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.event.count({ where })
  ]);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
};

router.post("/",
  body("name").isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || null;
    const ua = req.headers["user-agent"] || null;
    const { name, properties, anonymousId, userId, url } = req.body || {};

    const ev = await prisma.event.create({ data: { tenantId: req.tenant.id, name, properties, anonymousId, userId, ip, userAgent: ua, url } });
    const prev = await prisma.proofLedger.findFirst({ orderBy: { createdAt: "desc" } }).catch(()=>null);
    const hash = ledgerHash(prev?.hash || "", { type: "event", id: ev.id, tenant: req.tenant.key, name });
    await prisma.proofLedger.create({ data: { prevHash: prev?.hash || null, data: { type: "event", id: ev.id }, hash } });

    res.json({ event: ev });
  }
);

router.get("/",
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    res.json(await paginate({ tenantId: req.tenant.id }, page, limit));
  }
);

// pixel 1x1
router.get("/pixel.gif", async (req, res) => {
  const PIXEL = Buffer.from("R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==","base64");
  try {
    const key = (req.query.t || "default").toString().toLowerCase();
    let tenant = await prisma.tenant.findUnique({ where: { key } });
    if (!tenant) tenant = await prisma.tenant.create({ data: { key, name: key.toUpperCase() } });
    const ev = await prisma.event.create({ data: { tenantId: tenant.id, name: String(req.query.event || "pageview"), properties: req.query } });
    const prev = await prisma.proofLedger.findFirst({ orderBy: { createdAt: "desc" } }).catch(()=>null);
    const hash = ledgerHash(prev?.hash || "", { type: "pixel", id: ev.id, tenant: key });
    await prisma.proofLedger.create({ data: { prevHash: prev?.hash || null, data: { type: "pixel", id: ev.id }, hash } });
  } catch {}
  res.set("Content-Type","image/gif");
  res.set("Cache-Control","no-store");
  res.send(PIXEL);
});

// SDK minimal
router.get("/sdk.js", (_req, res) => {
  const js = `
(function(){
  function post(path, payload){
    try { fetch((window.NEXORA_API||'')+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})}); } catch(e){}
  }
  window.nexora = {
    track: function(name, props){ post('/events',{name:name,properties:props||{},url:location.href}); },
    lead: function(data){ var u=new URL(location.href); var t=u.searchParams.get('t')||window.NEXORA_TENANT||'default'; fetch((window.NEXORA_API||'')+'/leads?t='+t,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({landingPage:location.href},data||{}))}); }
  };
  var tenant=(window.NEXORA_TENANT||'default'); var i=new Image(); i.src=(window.NEXORA_API||'')+'/events/pixel.gif?t='+encodeURIComponent(tenant)+'&event=pageview&url='+encodeURIComponent(location.href);
})();`;
  res.set("Content-Type","application/javascript");
  res.send(js);
});

module.exports = router;
