const express = require("express");
const { prisma } = require("../lib/prisma");
const { resolveTenant } = require("../middlewares/tenant");

const router = express.Router();

router.get("/feature-flags", async (_req, res) => {
  const flags = await prisma.featureFlag.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ flags });
});

router.get("/reports/overview", resolveTenant, async (req, res) => {
  const [leadCount, clickCount, eventCount] = await Promise.all([
    prisma.lead.count({ where: { tenantId: req.tenant.id } }),
    prisma.click.count({ where: { tenantId: req.tenant.id } }),
    prisma.event.count({ where: { tenantId: req.tenant.id } })
  ]);
  res.json({ leadCount, clickCount, eventCount });
});

router.get("/healthz", (_req, res) => res.json({ ok: true }));

module.exports = router;
