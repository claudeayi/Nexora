// api/src/seed.js
/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

// ------- Helpers -------
const env = (k, d) => (process.env[k] && String(process.env[k]).trim()) || d;
const bool = (v) => ["1", "true", "yes", "y"].includes(String(v || "").toLowerCase());

const DEFAULT_TENANT_KEY = env("DEFAULT_TENANT_KEY", "default").toLowerCase();
const ADMIN_EMAIL = env("ADMIN_EMAIL", "admin@example.com");
const ADMIN_PASSWORD = env("ADMIN_PASSWORD", "admin123");
const ADMIN_NAME = env("ADMIN_NAME", "Admin");
const ADMIN_PLAN = env("ADMIN_PLAN", "pro");
const ADMIN_ROLE = env("ADMIN_ROLE", "admin");
const BCRYPT_ROUNDS = Number(env("BCRYPT_ROUNDS", 10));
const SEED_DEMO = bool(env("SEED_DEMO", "false"));

function sha256(obj) {
  const s = typeof obj === "string" ? obj : JSON.stringify(obj);
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function upsertTenant(key) {
  const k = key.toLowerCase();
  return prisma.tenant.upsert({
    where: { key: k },
    update: {},
    create: { key: k, name: k.toUpperCase() },
  });
}

async function upsertAdmin(tenantId) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  return prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {}, // si l'admin existe déjà, on ne modifie pas (évite d’écraser son mdp)
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: ADMIN_NAME,
      role: ADMIN_ROLE,
      plan: ADMIN_PLAN,
      tenantId,
    },
  });
}

async function ensureFeatureFlags() {
  const flags = [
    { key: "assistant", on: true, rules: null },
    { key: "copilot", on: true, rules: null },
    { key: "ab-testing", on: true, rules: null },
    { key: "pricing-ai", on: true, rules: null },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: { on: f.on, rules: f.rules },
      create: f,
    });
  }
}

async function ensureExperimentAB() {
  const name = "cta-text";
  let exp = await prisma.experiment.findUnique({ where: { name } });
  if (!exp) {
    exp = await prisma.experiment.create({
      data: {
        name,
        status: "active",
        variants: {
          create: [
            { name: "A", weight: 50 },
            { name: "B", weight: 50 },
          ],
        },
      },
      include: { variants: true },
    });
  }
  return exp;
}

async function writeGenesisBlock(tenantKey) {
  // Crée un premier bloc ProofLedger si la table est vide
  const count = await prisma.proofLedger.count();
  if (count > 0) return null;

  const data = { type: "genesis", tenant: tenantKey, at: new Date().toISOString() };
  const hash = sha256({ prevHash: null, data });
  return prisma.proofLedger.create({
    data: { prevHash: null, data, hash },
  });
}

async function seedDemoData(tenantId) {
  // Données de démo non sensibles
  const leads = [
    { email: "ceo@startup.com", name: "CEO", phone: "+237650000000", score: 72, utmSource: "linkedin", utmCampaign: "b2b-pro" },
    { email: "contact@pme.fr", name: "Claire", phone: "+33123456789", score: 61, utmSource: "google", utmCampaign: "retargeting" },
    { email: "hello@corp.de", name: "Jan", phone: "+4915123456789", score: 55, utmSource: "newsletter", utmCampaign: "spring" },
  ];
  const links = [
    { slug: "site", destination: "https://example.com" },
    { slug: "demo", destination: "https://example.com/demo" },
  ];

  for (const l of leads) {
    await prisma.lead.upsert({
      where: { email: l.email },
      update: {},
      create: { tenantId, ...l },
    });
  }

  for (const link of links) {
    // si slug existe déjà, on ignore
    try {
      await prisma.link.create({ data: { tenantId, ...link } });
    } catch (e) {
      if (e?.code !== "P2002") console.warn("link create warn:", e.message);
    }
  }

  // Quelques events basiques
  const now = new Date();
  for (let i = 0; i < 5; i += 1) {
    await prisma.event.create({
      data: {
        tenantId,
        name: "pageview",
        properties: { path: "/", i },
        createdAt: new Date(now.getTime() - i * 86400000),
      },
    });
  }
}

async function main() {
  console.log("🚀 Seeding Nexora…");
  console.log(` - Tenant: "${DEFAULT_TENANT_KEY}"`);
  console.log(` - Admin : ${ADMIN_EMAIL} (${ADMIN_ROLE}, ${ADMIN_PLAN})`);
  if (SEED_DEMO) console.log(" - Demo  : enabled");

  const tenant = await upsertTenant(DEFAULT_TENANT_KEY);
  const admin = await upsertAdmin(tenant.id);

  await ensureFeatureFlags();
  await ensureExperimentAB();
  await writeGenesisBlock(tenant.key);

  if (SEED_DEMO) {
    await seedDemoData(tenant.id);
  }

  console.log("✅ Seed completed:");
  console.log(`   Tenant       : ${tenant.key} (${tenant.id})`);
  console.log(`   Admin login  : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
