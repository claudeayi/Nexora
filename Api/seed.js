const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { key: "default" },
    update: {},
    create: { key: "default", name: "DEFAULT" },
  });

  const email = "admin@example.com";
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Admin",
      role: "admin",
      plan: "pro",
      tenantId: tenant.id,
    },
  });

  console.log("✅ Seed completed: admin@example.com / admin123");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
