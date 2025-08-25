const { prisma } = require("../lib/prisma");

async function resolveTenant(req, _res, next){
  try {
    let key = (req.headers["x-tenant"] || req.query.t || "default").toString().toLowerCase();
    if (req.user?.tenantKey) key = req.user.tenantKey;
    let tenant = await prisma.tenant.findUnique({ where: { key } });
    if (!tenant) tenant = await prisma.tenant.create({ data: { key, name: key.toUpperCase() } });
    req.tenant = tenant;
  } catch (e) { console.error("resolveTenant", e); }
  next();
}

module.exports = { resolveTenant };
