import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { simulateRequest } from './helpers.js';

describe('safe-redact Express Integration Tests (Zero Network)', () => {
  it('POST /login redacts password, token, and authorization headers from logs', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    const secretPassword = 'MySuperSecretPassword987!#$';
    const secretToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.secret_signature_here';
    const authHeader = 'Bearer my_private_oauth_token_12345';
    const sessionCookie = 'session_id=secret_cookie_value_999';

    const response = await simulateRequest(app, {
      method: 'POST',
      url: '/login',
      headers: {
        authorization: authHeader,
        cookie: sessionCookie,
      },
      body: {
        username: 'alice_smith',
        password: secretPassword,
        token: secretToken,
      },
    });

    // Verify response status and safe content
    assert.equal(response.statusCode, 200);
    const resJson = response.json();
    assert.equal(resJson.status, 'success');
    assert.equal(resJson.user, 'alice_smith');
    assert.equal(resJson.authenticated, true);

    // Verify response NEVER exposes password or token
    assert.equal('password' in resJson, false);
    assert.equal('token' in resJson, false);

    // Combine all captured logs
    const logOutput = logs.join('\n');

    // ASSERT SECRETS NEVER APPEAR IN LOGS
    assert.doesNotMatch(logOutput, new RegExp(secretPassword));
    assert.doesNotMatch(logOutput, new RegExp(secretToken));
    assert.doesNotMatch(logOutput, /secret_signature_here/);
    assert.doesNotMatch(logOutput, /my_private_oauth_token_12345/);
    assert.doesNotMatch(logOutput, /secret_cookie_value_999/);

    // Assert redactor placed [REDACTED] masks
    assert.match(logOutput, /\[REDACTED\]/);
    assert.match(logOutput, /"username":"alice_smith"/);
    assert.match(logOutput, /"password":"\[REDACTED\]"/);
    assert.match(logOutput, /"token":"\[REDACTED\]"/);
    assert.match(logOutput, /"authorization":"\[REDACTED\]"/);
    assert.match(logOutput, /"cookie":"\[REDACTED\]"/);
  });

  it('POST /payment redacts card numbers, cvv, and sensitive payment data from logs', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    const testCardNumber = '4111 1111 1111 1111';
    const testCvv = '789';
    const testExpiry = '11/29';

    const response = await simulateRequest(app, {
      method: 'POST',
      url: '/payment',
      headers: {
        'x-api-key': 'secret-api-key-live-abcdef',
      },
      body: {
        amount: 249.99,
        currency: 'USD',
        cardNumber: testCardNumber,
        cvv: testCvv,
        expiry: testExpiry,
      },
    });

    // Verify safe response
    assert.equal(response.statusCode, 200);
    const resJson = response.json();
    assert.equal(resJson.status, 'success');
    assert.equal(resJson.amount, 249.99);
    assert.equal(resJson.currency, 'USD');
    assert.equal(resJson.cardLast4, '1111');
    assert.equal('cardNumber' in resJson, false);
    assert.equal('cvv' in resJson, false);

    const logOutput = logs.join('\n');

    // ASSERT CARD NUMBER AND CVV NEVER APPEAR IN LOGS
    assert.doesNotMatch(logOutput, /4111 1111 1111 1111/);
    assert.doesNotMatch(logOutput, /4111111111111111/);
    assert.doesNotMatch(logOutput, /"cvv":"789"/);
    assert.doesNotMatch(logOutput, /secret-api-key-live-abcdef/);

    // Assert redactor placed masks in log
    assert.match(logOutput, /"cardNumber":"\[REDACTED\]"/);
    assert.match(logOutput, /"cvv":"\[REDACTED\]"/);
    assert.match(logOutput, /"x-api-key":"\[REDACTED\]"/);
    assert.match(logOutput, /"amount":249\.99/);
    assert.match(logOutput, /"currency":"USD"/);
  });

  it('redacts sensitive patterns embedded inside arbitrary text fields', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    await simulateRequest(app, {
      method: 'POST',
      url: '/payment',
      body: {
        amount: 50.0,
        cardNumber: '4111 1111 1111 1111',
        note: 'Customer provided card 4111 1111 1111 1111 in inquiry note',
      },
    });

    const logOutput = logs.join('\n');
    assert.doesNotMatch(logOutput, /4111 1111 1111 1111/);
    assert.match(logOutput, /Customer provided card \[REDACTED\] in inquiry note/);
  });

  it('handles invalid login requests safely without leaking submitted inputs', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    const secretPassword = 'AttemptPasswordWithoutUser!';

    const response = await simulateRequest(app, {
      method: 'POST',
      url: '/login',
      body: {
        password: secretPassword,
      },
    });

    assert.equal(response.statusCode, 400);
    const logOutput = logs.join('\n');
    assert.doesNotMatch(logOutput, new RegExp(secretPassword));
    assert.match(logOutput, /"password":"\[REDACTED\]"/);
  });

  it('GET /health logs safely with no body and returns 200', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    const response = await simulateRequest(app, {
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    const resJson = response.json();
    assert.equal(resJson.status, 'ok');

    const logOutput = logs.join('\n');
    assert.match(logOutput, /\[SAFE REQUEST\] GET \/health/);
  });
});

