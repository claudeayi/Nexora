const express = require("express");
const { body, validationResult, query, param } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { computeLeadScore, ledgerHash } = require("../lib/util");
const { resolveTenant } = require("../middlewares/tenant");

const router = express.Router();
router.use(resolveTenant);

const paginate = async (where, page, limit) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.lead.count({ where })
  ]);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
};

router.post("/",
  body("email").optional().isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const q = req.query || {};
    const b = req.body || {};
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || null;
    const ua = req.headers["user-agent"] || null;

    const score = computeLeadScore({
      email: b.email || "",
      phone: b.phone || "",
      utmSource: b.utmSource || q.utm_source || "",
      utmCampaign: b.utmCampaign || q.utm_campaign || ""
    });

    const lead = await prisma.lead.create({
      data: {
        tenantId: req.tenant.id,
        email: b.email || "",
        name: b.name || null,
        phone: b.phone || null,
        utmSource: b.utmSource || q.utm_source || null,
        utmMedium: b.utmMedium || q.utm_medium || null,
        utmCampaign: b.utmCampaign || q.utm_campaign || null,
        score
      }
    });

    const prev = await prisma.proofLedger.findFirst({ orderBy: { createdAt: "desc" } }).catch(()=>null);
    const hash = ledgerHash(prev?.hash || "", { type: "lead", id: lead.id, tenant: req.tenant.key, score });
    await prisma.proofLedger.create({ data: { prevHash: prev?.hash || null, data: { type: "lead", id: lead.id }, hash } });

    res.json({ lead });
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

router.delete("/:id", param("id").isString(), async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "lead_not_found" });
  }
});

module.exports = router;
