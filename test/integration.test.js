import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { simulateRequest } from './helpers.js';

describe('safe-redact Express Integration Tests (Zero Network)', () => {
  it('GET / serves the static live demo HTML page', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    const response = await simulateRequest(app, {
      method: 'GET',
      url: '/',
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] || '', /text\/html/);
    assert.match(response.body, /Safe Redact Interactive Playground/);
    assert.match(response.body, /Use fake data only\. Nothing is stored\./);
    assert.match(response.body, /@samruddhii13\/safe-redact/);
    assert.match(response.body, /4111 1111 1111 1111/);
    assert.match(response.body, /<button id="redactBtn">Redact<\/button>/);
  });

  it('POST /api/redact returns redacted copy and never leaks raw secrets in response or logs', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    const secretPassword = 'LiveDemoSecretPassword$789';
    const secretToken = 'tok_live_demo_auth_abcdef123456';
    const testCardNumber = '4111 1111 1111 1111';
    const secretEmail = 'fictional.user@example.com';

    const response = await simulateRequest(app, {
      method: 'POST',
      url: '/api/redact',
      body: {
        username: 'alex_demo',
        password: secretPassword,
        token: secretToken,
        cardNumber: testCardNumber,
        email: secretEmail,
        amount: 49.99,
        currency: 'USD',
      },
    });

    assert.equal(response.statusCode, 200);
    const resJson = response.json();

    // Verify safe fields remain intact
    assert.equal(resJson.username, 'alex_demo');
    assert.equal(resJson.amount, 49.99);
    assert.equal(resJson.currency, 'USD');

    // Verify sensitive fields are redacted in the response
    assert.equal(resJson.password, '[REDACTED]');
    assert.equal(resJson.token, '[REDACTED]');
    assert.equal(resJson.cardNumber, '[REDACTED]');
    assert.equal(resJson.email, '[REDACTED]');

    // Assert raw secrets never appear anywhere in the response text
    assert.doesNotMatch(response.body, new RegExp(secretPassword));
    assert.doesNotMatch(response.body, new RegExp(secretToken));
    assert.doesNotMatch(response.body, /4111 1111 1111 1111/);
    assert.doesNotMatch(response.body, new RegExp(secretEmail));

    // Assert raw secrets never appear anywhere in the captured server logs
    const logOutput = logs.join('\n');
    assert.doesNotMatch(logOutput, new RegExp(secretPassword));
    assert.doesNotMatch(logOutput, new RegExp(secretToken));
    assert.doesNotMatch(logOutput, /4111 1111 1111 1111/);
    assert.doesNotMatch(logOutput, new RegExp(secretEmail));

    // Assert logs confirm redaction occurred
    assert.match(logOutput, /\[SAFE REQUEST\] POST \/api\/redact/);
    assert.match(logOutput, /"password":"\[REDACTED\]"/);
    assert.match(logOutput, /"token":"\[REDACTED\]"/);
    assert.match(logOutput, /"cardNumber":"\[REDACTED\]"/);
  });

  it('POST /api/redact returns friendly 400 for invalid JSON payloads', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    const response = await simulateRequest(app, {
      method: 'POST',
      url: '/api/redact',
      headers: {
        'content-type': 'application/json',
      },
      body: '{ broken json: "missing closing quote, }',
    });

    assert.equal(response.statusCode, 400);
    const resJson = response.json();
    assert.equal(resJson.error, 'Invalid JSON');
    assert.match(resJson.message, /valid JSON/i);
  });

  it('POST /api/redact rejects payloads exceeding the 10kb limit with 413', async () => {
    const logs = [];
    const app = createApp({
      logger: (msg) => logs.push(msg),
    });

    // Generate payload larger than 10kb (10240 bytes)
    const largeString = 'A'.repeat(12 * 1024);
    const response = await simulateRequest(app, {
      method: 'POST',
      url: '/api/redact',
      body: {
        data: largeString,
      },
    });

    assert.equal(response.statusCode, 413);
    const resJson = response.json();
    assert.equal(resJson.error, 'Payload Too Large');
    assert.match(resJson.message, /10kb/i);
  });

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

    assert.equal(response.statusCode, 200);
    const resJson = response.json();
    assert.equal(resJson.status, 'success');
    assert.equal(resJson.user, 'alice_smith');
    assert.equal(resJson.authenticated, true);

    // Verify response NEVER exposes password or token
    assert.equal('password' in resJson, false);
    assert.equal('token' in resJson, false);

    const logOutput = logs.join('\n');
    assert.doesNotMatch(logOutput, new RegExp(secretPassword));
    assert.doesNotMatch(logOutput, new RegExp(secretToken));
    assert.doesNotMatch(logOutput, /secret_signature_here/);
    assert.doesNotMatch(logOutput, /my_private_oauth_token_12345/);
    assert.doesNotMatch(logOutput, /secret_cookie_value_999/);

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

    assert.equal(response.statusCode, 200);
    const resJson = response.json();
    assert.equal(resJson.status, 'success');
    assert.equal(resJson.amount, 249.99);
    assert.equal(resJson.currency, 'USD');
    assert.equal(resJson.cardLast4, '1111');
    assert.equal('cardNumber' in resJson, false);
    assert.equal('cvv' in resJson, false);

    const logOutput = logs.join('\n');
    assert.doesNotMatch(logOutput, /4111 1111 1111 1111/);
    assert.doesNotMatch(logOutput, /4111111111111111/);
    assert.doesNotMatch(logOutput, /"cvv":"789"/);
    assert.doesNotMatch(logOutput, /secret-api-key-live-abcdef/);

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
