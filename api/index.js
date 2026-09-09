// Vercel serverless entry — wraps the existing Express app so
// /api/* and /config.js work on Vercel deployments.
const app = require("../server/src/server");

module.exports = app;
