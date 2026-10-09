const path = require("node:path");

const rootDir = path.resolve(__dirname, "../..");

module.exports = {
  rootDir,
  port: Number(process.env.PORT) || 3211,
  isProduction: process.env.NODE_ENV === "production",
  webDistDir: path.join(rootDir, "server", "dist"),
  authCookieName: "abc_english_token",
  tokenMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
};
