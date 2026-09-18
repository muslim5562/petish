import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { dbV6?: PrismaClient };
export const db =
  globalDb.dbV6 ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    }),
  });
if (process.env.NODE_ENV !== "production") globalDb.dbV6 = db;
