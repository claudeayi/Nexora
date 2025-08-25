const express = require("express");
const { prisma } = require("../lib/prisma");

const router = express.Router();

function pickVariant(variants){
  const epsilon = 0.1;
  if (Math.random() < epsilon) return variants[Math.floor(Math.random()*variants.length)];
  let best = variants[0], bestRate = (best.conversions||0)/Math.max(1,best.views||1);
  for (const v of variants) {
    const r = (v.conversions||0)/Math.max(1,v.views||1);
    if (r > bestRate) { best = v; bestRate = r; }
  }
  return best;
}

router.get("/", async (_req, res) => {
  const experiments = await prisma.experiment.findMany({ include: { variants: true } });
  res.json({ experiments });
});

router.get("/:name/assign", async (req, res) => {
  const name = req.params.name;
  let exp = await prisma.experiment.findUnique({ where: { name }, include: { variants: true } });
  if (!exp) {
    exp = await prisma.experiment.create({
      data: { name, status: "active", variants: { create: [{ name:"A", weight:50 }, { name:"B", weight:50 }] } },
      include: { variants: true }
    });
  }
  const v = pickVariant(exp.variants);
  await prisma.variant.update({ where: { id: v.id }, data: { views: { increment: 1 } } });
  res.json({ experiment: name, variant: v.name });
});

router.post("/:name/convert", async (req, res) => {
  const exp = await prisma.experiment.findUnique({ where: { name: req.params.name }, include: { variants: true } });
  if (!exp) return res.status(404).json({ error: "experiment_not_found" });
  const v = exp.variants.find(x => x.name === (req.body?.variant || "A"));
  if (!v) return res.status(404).json({ error: "variant_not_found" });
  await prisma.variant.update({ where: { id: v.id }, data: { conversions: { increment: 1 } } });
  res.json({ ok: true });
});

module.exports = router;
