import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';

const prisma = new PrismaClient();

async function verify() {
    const PORT = config.server.port;
    // Use a unique URL to ensure we find the specific log for this run
    const uniqueTag = `verify-audit-${Date.now()}`;
    const url = `http://localhost:${PORT}/api/${uniqueTag}`;

    console.log(`Making request to ${url}...`);

    try {
        const res = await fetch(url);
        console.log(`Response status: ${res.status}`);
    } catch (err) {
        console.log('Fetch error (expected if server returns error or connection issue):', err);
    }

    console.log('Waiting for logs to be written...');
    // Allow some time for async logging
    await new Promise(r => setTimeout(r, 2000));

    const log = await (prisma as any).apiAuditLog.findFirst({
        where: {
            requestUrl: {
                contains: uniqueTag
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (log) {
        console.log('✅ Audit Log Verification PASSED!');
        console.log('Log entry:', JSON.stringify(log, null, 2));
    } else {
        console.error('❌ Audit Log Verification FAILED: No log found.');
        process.exit(1);
    }
}

verify()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
