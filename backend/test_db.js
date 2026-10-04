const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    console.log("DB connected, first user:", user);
  } catch (e) {
    console.error("DB error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
