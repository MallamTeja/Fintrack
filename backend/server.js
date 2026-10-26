// Entry point.
//  - Vercel (@vercel/node) imports this file and uses the exported Express app as the handler.
//  - `node server.js` starts a normal HTTP server for local development.
const app = require('./src/app');
const { config, assertConfig } = require('./src/config');

if (require.main === module) {
    assertConfig();
    app.listen(config.port, () => console.log(`FinTrack running on http://localhost:${config.port}`));
}

module.exports = app;
