// Vercel serverless entry point. Local dev still uses server.js (which calls
// app.listen()) — this file is only ever loaded by Vercel's Node.js runtime,
// which wraps the exported Express app as a request handler instead of
// letting it bind to a port itself.
require('dotenv').config();
const createApp = require('../src/app');

module.exports = createApp();
