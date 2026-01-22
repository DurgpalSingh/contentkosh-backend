
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../src/constants/permission.constants';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding permissions...');

    try {
        await prisma.$transaction(async (tx) => {
            for (const p of PERMISSIONS) {
                await tx.permission.upsert({
                    where: { code: p.code },
                    update: {},
                    create: p,
                });
            }
        });
        console.log('Permissions seeded successfully.');
    } catch (error: any) {
        console.error('Error seeding permissions:', error.message || error);
        throw error;
    }
}

main()
    .catch((e) => {
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
