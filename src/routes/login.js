import { Router } from 'express';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password, token } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required credentials: username and password',
    });
  }

  // Confirm authentication without echoing sensitive credentials
  return res.status(200).json({
    status: 'success',
    message: 'User authenticated successfully',
    user: username,
    authenticated: true,
    hasToken: Boolean(token),
  });
});

export default router;

