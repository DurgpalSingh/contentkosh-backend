import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@contentkosh.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Password#123';
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Super Admin';

async function main() {
  console.log('Seeding platform Super Admin...');

  const existing = await prisma.user.findFirst({
    where: { email: SUPERADMIN_EMAIL, businessId: null, role: UserRole.SUPERADMIN },
  });

  if (existing) {
    console.log(`Super Admin already exists: ${existing.email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

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

  console.log(`Created Super Admin: ${superAdmin.email} (Password: ${SUPERADMIN_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error('Error seeding Super Admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
