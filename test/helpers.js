import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

/**
 * Simulates an HTTP request to an Express application without binding network sockets.
 *
 * @param {import('express').Express} app
 * @param {Object} options
 * @param {string} [options.method='GET']
 * @param {string} [options.url='/']
 * @param {Object} [options.headers={}]
 * @param {any} [options.body=null]
 * @returns {Promise<{ statusCode: number, headers: Object, body: string, json: () => any }>}
 */
export function simulateRequest(app, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== null && body !== undefined
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : null;

    let pushed = false;
    const req = new Readable({
      read() {
        if (!pushed) {
          pushed = true;
          if (payload) {
            this.push(payload);
          }
          this.push(null);
        }
      },
    });

    req.method = method.toUpperCase();
    req.url = url;
    req.headers = {
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(payload)),
      } : {}),
      ...headers,
    };

    const res = new EventEmitter();
    const resHeaders = {};
    res.statusCode = 200;

    res.setHeader = (key, val) => {
      resHeaders[String(key).toLowerCase()] = val;
    };
    res.getHeader = (key) => resHeaders[String(key).toLowerCase()];
    res.hasHeader = (key) => String(key).toLowerCase() in resHeaders;
    res.removeHeader = (key) => {
      delete resHeaders[String(key).toLowerCase()];
    };

    const chunks = [];
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };

    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      resolve({
        statusCode: res.statusCode,
        headers: resHeaders,
        body: bodyStr,
        json() {
          return bodyStr ? JSON.parse(bodyStr) : null;
        },
      });
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });
}
