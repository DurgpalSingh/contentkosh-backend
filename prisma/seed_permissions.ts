
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
    { code: 'CONTENT_CREATE', description: 'Create content' },
    { code: 'CONTENT_EDIT', description: 'Edit content' },
    { code: 'CONTENT_DELETE', description: 'Delete content' },
    { code: 'CONTENT_VIEW', description: 'View content' },
    { code: 'ANNOUNCEMENT_CREATE', description: 'Create announcement' },
    { code: 'ANNOUNCEMENT_VIEW', description: 'View announcement' },
];

async function main() {
    console.log('Seeding permissions...');
    for (const p of permissions) {
        await prisma.permission.upsert({
            where: { code: p.code },
            update: {},
            create: p,
        });
    }
    console.log('Permissions seeded.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
