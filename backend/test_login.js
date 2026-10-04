const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testLogin() {
  const email = 'teacher@malphor.ai';
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    console.log("User:", user);
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
