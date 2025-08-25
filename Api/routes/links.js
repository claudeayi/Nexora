const express = require("express");
const { body, validationResult, query, param } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { nanoid } = require("nanoid");
const { resolveTenant } = require("../middlewares/tenant");

const router = express.Router();
router.use(resolveTenant);

const paginate = async (where, page, limit) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.link.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.link.count({ where })
  ]);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
};

router.post("/",
  body("destination").isURL(),
  body("slug").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { destination, slug } = req.body;
    const s = slug && slug.length >= 3 ? slug : nanoid(7);
    try {
      const link = await prisma.link.create({ data: { tenantId: req.tenant.id, destination, slug: s } });
      res.json({ link });
    } catch (e) {
      if (e.code === "P2002") return res.status(400).json({ error: "slug_taken" });
      res.status(500).json({ error: "link_create_failed" });
    }
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
    await prisma.link.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "link_not_found" });
  }
});

// redirection publique: /links/r/:slug
router.get("/r/:slug", async (req, res) => {
  const link = await prisma.link.findUnique({ where: { slug: req.params.slug } });
  if (!link) return res.status(404).send("Not found");
  res.redirect(link.destination);
});

module.exports = router;
