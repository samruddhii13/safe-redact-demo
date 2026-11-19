import express from 'express';
import { createRequestLogger } from './middleware/request-logger.js';
import loginRouter from './routes/login.js';
import paymentRouter from './routes/payment.js';

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

  // Parse incoming JSON request bodies
  app.use(express.json());

  // Attach safe request logging middleware
  app.use(createRequestLogger(options));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'safe-redact-demo' });
  });

  // Mount API routes
  app.use(loginRouter);
  app.use(paymentRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Error handling middleware
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
    });
  });

  return app;
}

