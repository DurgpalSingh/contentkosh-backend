import { auditService } from '../services/audit.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log('Usage: npx tsx src/scripts/audit-control.ts [enable|disable|status]');
        process.exit(1);
    }

    try {
        if (command === 'enable') {
            await auditService.setAuditingEnabled(true);
            console.log('Auditing Enabled');
        } else if (command === 'disable') {
            await auditService.setAuditingEnabled(false);
            console.log('Auditing Disabled');
        } else if (command === 'status') {
            const isEnabled = await auditService.isAuditingEnabled();
            console.log(`Auditing is currently: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
        } else {
            console.log('Invalid command. Use: enable, disable, or status');
            process.exit(1);
        }
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
