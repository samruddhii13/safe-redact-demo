import { createRedactor } from '@samruddhii13/safe-redact';

/**
 * Common API keys and tokens in headers and bodies to redact in addition to defaults.
 */
export const DEFAULT_EXTRA_KEYS = [
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'api-key',
  'token',
];

/**
 * Builds or retrieves a configured redactor instance.
 *
 * @param {Object} [options]
 * @returns {Function}
 */
export function buildRedactor(options = {}) {
  if (options.redactor) {
    return options.redactor;
  }

  const redactOptions = {
    keys: DEFAULT_EXTRA_KEYS,
    ...(options.redactOptions || {}),
  };

  if (options.redactOptions?.keys) {
    redactOptions.keys = [...DEFAULT_EXTRA_KEYS, ...options.redactOptions.keys];
  }

  return createRedactor(redactOptions);
}

/**
 * Creates an Express request logging middleware that sanitizes
 * method, path, headers, and body before outputting to the logger.
 *
 * @param {Object} [options]
 * @param {Function} [options.logger=console.log] - Output destination for logs.
 * @param {Object} [options.redactOptions] - Custom options for createRedactor.
 * @param {Function} [options.redactor] - Pre-compiled redactor function.
 * @returns {Function} Express middleware function
 */
export function createRequestLogger(options = {}) {
  const logger = options.logger || console.log;
  const redactor = buildRedactor(options);

  return function requestLogger(req, res, next) {
    const rawData = {
      method: req.method,
      path: req.originalUrl || req.url,
      headers: req.headers,
      body: req.body,
    };

    // Redact all sensitive fields and patterns
    const safeData = redactor(rawData);

    logger(
      `[SAFE REQUEST] ${safeData.method} ${safeData.path} | headers: ${JSON.stringify(safeData.headers)} | body: ${JSON.stringify(safeData.body)}`
    );

    next();
  };
}
