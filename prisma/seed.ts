import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@zled.com' },
    update: {},
    create: {
      email: 'admin@zled.com',
      name: 'Admin',
      password: hashedPassword,
      role: 'admin',
      settings: {
        create: {
          pageDuration: 60,
        },
      },
    },
  });

  console.log('Admin user created:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
