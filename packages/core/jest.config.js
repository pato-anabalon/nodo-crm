/** Pure TypeScript, so SWC and nothing else: no DOM, no Next, no Prisma. */
module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.ts$": ["@swc/jest"] },
};
