import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { withStrictSsl } from "./connection";

// In development Next reloads modules on every change; without the singleton
// we'd open a new pool per reload until Neon's connections ran out.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Run `vercel env pull .env.local`.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: withStrictSsl(connectionString) }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
