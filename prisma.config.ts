import { config as loadEnv } from "dotenv";

// Vercel deja las credenciales en .env.local; Prisma 7 ya no carga .env solo.
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Solo la usa el CLI (migraciones, studio, seed). Va sin el pooler de Neon
    // porque las migraciones necesitan una sesión estable.
    // La app en cambio se conecta por el pooler, vía src/lib/db/prisma.ts.
    url: env("DATABASE_URL_UNPOOLED"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
