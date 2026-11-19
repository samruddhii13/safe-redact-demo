import { Router } from 'express';

const router = Router();

router.post('/payment', (req, res) => {
  const { amount, currency = 'USD', cardNumber, cvv, expiry } = req.body || {};

  if (!amount || !cardNumber) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required payment details: amount and cardNumber',
    });
  }

  // Extract only non-sensitive metadata for confirmation
  const digitsOnly = String(cardNumber).replace(/\D/g, '');
  const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '****';

  return res.status(200).json({
    status: 'success',
    message: 'Payment processed successfully',
    transactionId: `txn_demo_${Date.now()}`,
    amount: Number(amount),
    currency,
    cardLast4: last4,
    hasCvv: Boolean(cvv),
    expirySet: Boolean(expiry),
  });
});

export default router;

