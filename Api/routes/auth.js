const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");

const router = express.Router();

function signToken(user, tenant){
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, plan: user.plan, tenantId: tenant.id, tenantKey: tenant.key },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

router.post("/register",
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  body("tenantKey").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name, tenantKey="default" } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: "email_exists" });

    let tenant = await prisma.tenant.findUnique({ where: { key: tenantKey.toLowerCase() } });
    if (!tenant) tenant = await prisma.tenant.create({ data: { key: tenantKey.toLowerCase(), name: tenantKey.toUpperCase() } });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash, name, tenantId: tenant.id } });
    const token = signToken(user, tenant);
    res.json({ token, user: { id: user.id, email: user.email, plan: user.plan, tenant: tenant.key } });
  }
);

router.post("/login",
  body("email").isEmail(),
  body("password").isString(),
  async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "invalid_credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    const token = signToken(user, tenant);
    res.json({ token, user: { id: user.id, email: user.email, plan: user.plan, tenant: tenant.key } });
  }
);

router.get("/me", async (req, res) => {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const u = await prisma.user.findUnique({ where: { id: payload.sub } });
    const t = await prisma.tenant.findUnique({ where: { id: u.tenantId } });
    res.json({ user: { id: u.id, email: u.email, plan: u.plan, tenant: t.key } });
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
});

module.exports = router;
