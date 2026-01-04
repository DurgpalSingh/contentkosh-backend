
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyUniqueness() {
    try {
        const businessId = 1;
        const name = "Unique Exam Test " + Date.now();

        // Create first
        await prisma.exam.create({
            data: {
                name,
                businessId,
                status: 'ACTIVE',
            }
        });
        console.log("First exam created");

        // Try creating duplicate
        await prisma.exam.create({
            data: {
                name,
                businessId,
                status: 'ACTIVE',
            }
        });

    } catch (e) {
        if (e.code === 'P2002') {
            console.log("SUCCESS: Caught expected uniqueness error");
            process.exit(0);
        }
        console.error("FAILED: Unexpected error", e);
        process.exit(1);
    }
}

verifyUniqueness();
