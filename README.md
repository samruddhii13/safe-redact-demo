# safe-redact-demo

A minimal, secure Express API demonstrating zero-leak request logging using the published npm package [`@samruddhii13/safe-redact`](https://www.npmjs.com/package/@samruddhii13/safe-redact).

---

## Overview

In modern web services, logging raw HTTP requests can inadvertently expose sensitive credentials, authentication tokens, and payment card details to observability sinks, dashboards, and persistent storage.

`safe-redact-demo` showcases how to integrate `@samruddhii13/safe-redact`'s `createRedactor` into an Express request-logging middleware. All incoming HTTP methods, paths, headers, and request bodies are non-destructively sanitized before being written to stdout. The application contains **zero** endpoints or code paths that log or leak raw sensitive data.

---

## Illustrative Comparison: Unsafe vs Safe Logging

> **Note:** The "Unsafe Logging" example below is purely illustrative documentation. This repository does not contain any runnable unsafe endpoints.

### Unsafe Logging (Vulnerable Pattern)

When raw requests are printed directly using `console.log(req.body)` or `console.log(req.headers)`:

```text
[UNSAFE REQUEST] POST /login
Headers: { "authorization": "Bearer eyJhbGciOi...", "host": "api.example.com" }
Body: {
  "username": "alice",
  "password": "MySuperSecretPassword123!",
  "token": "tok_live_839201948"
}

[UNSAFE REQUEST] POST /payment
Headers: { "x-api-key": "sk_live_948201948201" }
Body: {
  "amount": 149.99,
  "currency": "USD",
  "cardNumber": "4111 1111 1111 1111",
  "cvv": "789",
  "expiry": "12/28"
}
```

*Risks:* Passwords, session tokens, and credit card numbers are exposed directly in plaintext logs, violating security compliance standards (PCI-DSS, GDPR).

---

### Safe Logging (This Project with `@samruddhii13/safe-redact`)

When requests pass through the `createRequestLogger` middleware powered by `createRedactor`:

```text
[SAFE REQUEST] POST /login | headers: {"authorization":"[REDACTED]","host":"localhost:3000"} | body: {"username":"alice","password":"[REDACTED]","token":"[REDACTED]"}

[SAFE REQUEST] POST /payment | headers: {"x-api-key":"[REDACTED]","host":"localhost:3000"} | body: {"amount":149.99,"currency":"USD","cardNumber":"[REDACTED]","cvv":"[REDACTED]","expiry":"12/28"}
```

*Benefits:*
- Deep, non-mutating redaction: route handlers still receive the original values needed to authenticate or charge, but logs never record them.
- Detects sensitive keys (e.g. `password`, `token`, `cardNumber`, `cvv`, `authorization`, `x-api-key`).
- Detects sensitive patterns via regex and Luhn algorithm (credit card numbers, Bearer tokens, JWTs, AWS keys).

---

## Installation

Clone the repository and install the published package from the npm registry:

```bash
git clone https://github.com/samruddhii13/safe-redact-demo.git
cd safe-redact-demo
npm install
```

The package dependency is installed directly from the npm registry:
```bash
npm install @samruddhii13/safe-redact
```

---

## Running the Application

### Start the Server

```bash
npm start
```

The API will start listening on port `3000` (or the port defined by `PORT`).

```text
[safe-redact-demo] Server running at http://localhost:3000
[safe-redact-demo] All incoming requests are safely redacted prior to logging.
```

### Run Tests

Integration tests use Node.js's built-in test runner (`node:test`) and execute in-memory with zero network overhead:

```bash
npm test
```

---

## API Endpoints & Curl Examples

### 1. `POST /login`

Accepts authentication payloads with username, password, and tokens.

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret_bearer_token_abc123" \
  -d '{
    "username": "alice",
    "password": "SuperSecretPassword123!",
    "token": "tok_demo_token_999"
  }'
```

**Response (HTTP 200):**
```json
{
  "status": "success",
  "message": "User authenticated successfully",
  "user": "alice",
  "authenticated": true,
  "hasToken": true
}
```

**Captured Server Log:**
```text
[SAFE REQUEST] POST /login | headers: {"content-type":"application/json","authorization":"[REDACTED]"} | body: {"username":"alice","password":"[REDACTED]","token":"[REDACTED]"}
```

---

### 2. `POST /payment`

Accepts payment details with fictional credit cards (e.g., test numbers like `4111 1111 1111 1111`), CVV, and amounts.

```bash
curl -X POST http://localhost:3000/payment \
  -H "Content-Type: application/json" \
  -H "x-api-key: live_secret_api_key_44321" \
  -d '{
    "amount": 75.50,
    "currency": "USD",
    "cardNumber": "4111 1111 1111 1111",
    "cvv": "123",
    "expiry": "09/27"
  }'
```

**Response (HTTP 200):**
```json
{
  "status": "success",
  "message": "Payment processed successfully",
  "transactionId": "txn_demo_1732041234567",
  "amount": 75.5,
  "currency": "USD",
  "cardLast4": "1111",
  "hasCvv": true,
  "expirySet": true
}
```

**Captured Server Log:**
```text
[SAFE REQUEST] POST /payment | headers: {"content-type":"application/json","x-api-key":"[REDACTED]"} | body: {"amount":75.5,"currency":"USD","cardNumber":"[REDACTED]","cvv":"[REDACTED]","expiry":"09/27"}
```

---

### 3. `GET /health`

Health check endpoint.

```bash
curl http://localhost:3000/health
```

**Response (HTTP 200):**
```json
{
  "status": "ok",
  "service": "safe-redact-demo"
}
```

---

## Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs tests across Node.js versions:
- Node.js 22
- Node.js 24

---

## License

[MIT](LICENSE)
