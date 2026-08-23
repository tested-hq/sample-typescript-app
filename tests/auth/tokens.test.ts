import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  TokenMalformedError,
  TokenTamperError,
  generateToken,
  verifyToken,
} from '../../src/auth/tokens.js';

const DEV_SECRET = 'sample-app-dev-secret-do-not-use-in-prod';

describe('generateToken + verifyToken', () => {
  it('round-trips a payload', () => {
    const payload = { sid: 'sess_1', uid: 'usr_1', iat: 1_700_000_000_000 };
    const token = generateToken(payload);
    expect(token.split('.')).toHaveLength(2);
    expect(verifyToken<typeof payload>(token)).toEqual(payload);
  });

  it('round-trips nested and empty objects', () => {
    expect(verifyToken(generateToken({}))).toEqual({});
    expect(verifyToken(generateToken({ nested: { ok: true }, n: 0 }))).toEqual({
      nested: { ok: true },
      n: 0,
    });
  });
});

describe('verifyToken malformed tokens', () => {
  it('rejects tokens that are not <body>.<sig>', () => {
    expect(() => verifyToken('no-separator')).toThrow(TokenMalformedError);
    expect(() => verifyToken('a.b.c')).toThrow(TokenMalformedError);
    expect(() => verifyToken('')).toThrow(/expected <body>\.<sig>/);
  });

  it('rejects a well-signed body that is not JSON', () => {
    const body = Buffer.from('not-json', 'utf8').toString('base64url');
    const sig = createHmac('sha256', process.env['TOKEN_SECRET'] ?? DEV_SECRET)
      .update(body)
      .digest('base64url');
    expect(() => verifyToken(`${body}.${sig}`)).toThrow(TokenMalformedError);
    expect(() => verifyToken(`${body}.${sig}`)).toThrow(/payload is not valid JSON/);
  });
});

describe('verifyToken tampered tokens', () => {
  it('rejects a flipped signature of the same length', () => {
    const token = generateToken({ a: 1 });
    const [body, sig] = token.split('.') as [string, string];
    const flipped = `${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
    expect(() => verifyToken(`${body}.${flipped}`)).toThrow(TokenTamperError);
    expect(() => verifyToken(`${body}.${flipped}`)).toThrow(/token signature mismatch/);
  });

  it('rejects a signature with a different length', () => {
    const token = generateToken({ a: 1 });
    const [body, sig] = token.split('.') as [string, string];
    expect(() => verifyToken(`${body}.${sig}x`)).toThrow(TokenTamperError);
  });
});
