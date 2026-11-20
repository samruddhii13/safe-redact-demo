import { Router } from 'express';
import { createRedactor } from '@samruddhii13/safe-redact';

const router = Router();
const defaultRedactor = createRedactor();

router.post('/api/redact', (req, res) => {
  if (req.body === undefined || req.body === null) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body must be valid JSON.',
    });
  }

  // Use the application-configured redactor or default instance
  const redactor = req.app.get('redactor') || defaultRedactor;

  // Generate deep, non-mutating redacted copy
  const redacted = redactor(req.body);

  return res.status(200).json(redacted);
});

export default router;
