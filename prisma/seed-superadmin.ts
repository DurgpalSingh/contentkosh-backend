import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'info@contentkosh.com';
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Super Admin';

async function main() {
  const plainPassword = process.argv[2];
  if (!plainPassword) {
    console.error('Usage: npx tsx prisma/seed-superadmin.ts <plain-password>');
    process.exit(1);
  }

  console.log('Seeding platform Super Admin...');

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findFirst({
      where: { email: SUPERADMIN_EMAIL, businessId: null, role: UserRole.SUPERADMIN },
    });

    if (existing) {
      console.log(`Super Admin already exists: ${existing.email}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const superAdmin = await prisma.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        password: hashedPassword,
        name: SUPERADMIN_NAME,
        businessId: null,
        role: UserRole.SUPERADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    console.log(`Created Super Admin: ${superAdmin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Error seeding Super Admin:', e);
  process.exit(1);
});
