import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestLogger } from '../src/middleware/request-logger.js';

describe('createRequestLogger Middleware Unit Tests', () => {
  it('calls logger with redacted clone without mutating req.body or req.headers', () => {
    const logs = [];
    const middleware = createRequestLogger({
      logger: (entry) => logs.push(entry),
    });

    const originalBody = {
      username: 'sam',
      password: 'OriginalPassword123!',
      nested: {
        token: 'secret_jwt_token_here',
      },
    };

    const originalHeaders = {
      authorization: 'Bearer secret_auth_bearer',
      'user-agent': 'curl/8.7.1',
    };

    const req = {
      method: 'POST',
      url: '/test',
      originalUrl: '/test',
      headers: originalHeaders,
      body: originalBody,
    };

    const res = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware(req, res, next);

    // 1. Next was invoked
    assert.equal(nextCalled, true);

    // 2. Original req was NOT mutated
    assert.equal(req.body.password, 'OriginalPassword123!');
    assert.equal(req.body.nested.token, 'secret_jwt_token_here');
    assert.equal(req.headers.authorization, 'Bearer secret_auth_bearer');

    // 3. Logger received sanitized output
    assert.equal(logs.length, 1);
    const log = logs[0];
    assert.match(log, /"password":"\[REDACTED\]"/);
    assert.match(log, /"token":"\[REDACTED\]"/);
    assert.match(log, /"authorization":"\[REDACTED\]"/);
    assert.doesNotMatch(log, /OriginalPassword123!/);
    assert.doesNotMatch(log, /secret_jwt_token_here/);
    assert.doesNotMatch(log, /secret_auth_bearer/);
  });
});

