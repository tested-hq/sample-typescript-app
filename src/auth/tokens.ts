// Lightweight signed-token helper. Not a JWT — this is a compact
// `<payload>.<signature>` format using HMAC-SHA256, sufficient for the kind of
// short-lived tokens this sample app traffics in. Zero test coverage on purpose
// — this file is a `tested diff` demo target.

import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env['TOKEN_SECRET'] ?? 'sample-app-dev-secret-do-not-use-in-prod';
const ALG = 'sha256';

export class TokenTamperError extends Error {
  constructor() {
    super('token signature mismatch');
    this.name = 'TokenTamperError';
  }
}

export class TokenMalformedError extends Error {
  constructor(reason: string) {
    super(`token malformed: ${reason}`);
    this.name = 'TokenMalformedError';
  }
}

function sign(payload: string): string {
  return createHmac(ALG, SECRET).update(payload).digest('base64url');
}

export function generateToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, 'utf8').toString('base64url');
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new TokenMalformedError('expected <body>.<sig>');
  }
  const [body, sig] = parts as [string, string];
  const expected = sign(body);

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TokenTamperError();
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    throw new TokenMalformedError('payload is not valid JSON');
  }
}
