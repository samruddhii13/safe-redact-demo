/**
 * Starts the Express application on an ephemeral localhost port (127.0.0.1),
 * dispatches the request using the built-in global fetch, and ensures the
 * server is cleanly closed in a finally block.
 *
 * @param {import('express').Express} app
 * @param {Object} options
 * @param {string} [options.method='GET']
 * @param {string} [options.url='/']
 * @param {Object} [options.headers={}]
 * @param {any} [options.body=null]
 * @returns {Promise<{ statusCode: number, headers: Object, body: string, json: () => any }>}
 */
export async function simulateRequest(app, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });

  try {
    const { port } = server.address();
    const targetPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = `http://127.0.0.1:${port}${targetPath}`;

    const payload = body !== null && body !== undefined
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : null;

    const reqHeaders = {
      ...(payload !== null ? { 'content-type': 'application/json' } : {}),
      ...headers,
    };

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: reqHeaders,
    };

    if (payload !== null && !['GET', 'HEAD'].includes(fetchOptions.method)) {
      fetchOptions.body = payload;
    }

    const res = await fetch(fullUrl, fetchOptions);
    const bodyText = await res.text();

    const headersObj = {};
    for (const [key, value] of res.headers.entries()) {
      headersObj[key.toLowerCase()] = value;
    }

    return {
      statusCode: res.status,
      headers: headersObj,
      body: bodyText,
      json() {
        return bodyText ? JSON.parse(bodyText) : null;
      },
    };
  } finally {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }
}
