import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[safe-redact-demo] Server running at http://localhost:${PORT}`);
  console.log('[safe-redact-demo] All incoming requests are safely redacted prior to logging.');
});

export default server;

