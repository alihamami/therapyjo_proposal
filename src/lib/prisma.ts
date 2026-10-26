import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Supabase's session pooler (port 5432) gives every open client one of
// only 15 slots at Nano, busy or idle, and a busy clinic afternoon ran
// out: "(EMAXCONNSESSION) max clients reached in session mode - max
// clients are limited to pool_size: 15", 71 times in the pooler logs on
// 2026-10-25. The transaction pooler is the same host, user and password
// on port 6543, and holds a slot only while a query runs. Switch to it
// here rather than in the Vercel variable: that value is marked Sensitive
// and cannot be read back, and doing it in code means a pasted
// session-pooler string can never bring the outage back. A URL already on
// 6543, a direct connection and localhost all pass through unchanged.
// Only this runtime pool switches: prisma.config.ts hands the raw variable
// to the Prisma CLI, which stays in session mode. (TJ-063a)
function transactionPoolerUrl(url: string): string {
    return url.replace(/@([^@/?#]+\.pooler\.supabase\.com):5432(?=[/?#]|$)/, "@$1:6543");
}

function createPrismaClient() {
    const pool = new pg.Pool({
        connectionString: transactionPoolerUrl(process.env.DATABASE_URL!),
        ssl: { rejectUnauthorized: false },
        max: 3,
        // pg-pool waits for a connection with no time limit by default.
        // When the pooler is full, a request then hangs until the pooler
        // itself rejects it, and staff see a frozen page. Give up after
        // 10 seconds instead: far longer than a healthy connect, and far
        // shorter than the pooler's own queue. (TJ-063a)
        connectionTimeoutMillis: 10000,
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
