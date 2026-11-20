import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestLogger, buildRedactor } from './middleware/request-logger.js';
import loginRouter from './routes/login.js';
import paymentRouter from './routes/payment.js';
import redactRouter from './routes/redact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

/**
 * Express application factory.
 *
 * @param {Object} [options]
 * @param {Function} [options.logger=console.log] - Log sink function.
 * @param {Object} [options.redactOptions] - Options passed to createRedactor.
 * @param {Function} [options.redactor] - Pre-created redactor instance.
 * @returns {express.Express}
 */
export function createApp(options = {}) {
  const app = express();

  // Pre-compile redactor instance and make accessible to routes
  const redactor = buildRedactor(options);
  app.set('redactor', redactor);

  // Parse incoming JSON request bodies with a 10kb limit
  app.use(express.json({ limit: '10kb' }));

  // Attach safe request logging middleware (never logs unredacted data)
  app.use(createRequestLogger({ ...options, redactor }));

  // Serve static assets from public directory (without automatic directory index)
  app.use(express.static(publicDir, { index: false }));

  // Serve the public live demo page at GET /
  const indexHtmlPath = path.join(publicDir, 'index.html');
  app.get('/', (req, res) => {
    try {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      res.type('html').send(html);
    } catch {
      res.status(500).send('Unable to load demo page');
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'safe-redact-demo' });
  });

  // Mount API routes
  app.use(redactRouter);
  app.use(loginRouter);
  app.use(paymentRouter);

  // 404 handler for unmatched routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Central error handling middleware
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Friendly handling for malformed JSON bodies
    if (err instanceof SyntaxError && (err.status === 400 || 'body' in err)) {
      return res.status(400).json({
        error: 'Invalid JSON',
        message: 'The request body must be valid JSON.',
      });
    }

    // Friendly handling for payloads exceeding the 10kb limit
    if (err.type === 'entity.too.large' || err.status === 413) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: 'Request body exceeds the 10kb limit.',
      });
    }

    res.status(err.status || 500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
    });
  });

  return app;
}
