import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/generated/**",
    "!src/components/ui/**",
    "!src/**/*.d.ts",
  ],
};

/**
 * `next/jest` define su propio `transformIgnorePatterns`, que se salta todo
 * node_modules. next-intl y use-intl se publican como ESM puro, así que hay que
 * quitar ese patrón para que Jest sí los transforme.
 */
export default async function jestConfig(): Promise<Config> {
  const generated = await createJestConfig(config)();

  return {
    ...generated,
    transformIgnorePatterns: (generated.transformIgnorePatterns ?? []).filter(
      (pattern) => !pattern.includes("node_modules"),
    ),
  };
}
