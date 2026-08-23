import { beforeEach, describe, expect, it } from 'vitest';
import { generateToken } from '../../src/auth/tokens.js';
import {
  SessionExpiredError,
  SessionNotFoundError,
  SessionRevokedError,
  _resetSessions,
  createSession,
  revokeSession,
  validateSession,
} from '../../src/auth/session.js';

beforeEach(() => {
  _resetSessions();
});

describe('createSession', () => {
  it('returns a session whose expiry is in the future', async () => {
    const session = await createSession({ userId: 'usr_1' });
    expect(session.id).toMatch(/^sess_/);
    expect(session.userId).toBe('usr_1');
    expect(session.token.split('.')).toHaveLength(2);
    expect(session.revokedAt).toBeNull();
    expect(session.expiresAt).toBeGreaterThan(session.createdAt);
  });

  it('honors a custom ttlDays', async () => {
    const session = await createSession({ userId: 'usr_2', ttlDays: 1 });
    const oneDayMs = 86_400_000;
    expect(session.expiresAt - session.createdAt).toBe(oneDayMs);
  });
});

describe('validateSession', () => {
  it('returns the live session for a valid token', async () => {
    const session = await createSession({ userId: 'usr_1' });
    await expect(validateSession(session.token)).resolves.toEqual(session);
  });

  it('throws when the session id in the token is unknown', async () => {
    const token = generateToken({ sid: 'sess_missing', uid: 'usr_1', iat: 1 });
    await expect(validateSession(token)).rejects.toBeInstanceOf(SessionNotFoundError);
    await expect(validateSession(token)).rejects.toMatchObject({
      message: 'session not found: sess_missing',
    });
  });

  it('throws after the session has been revoked', async () => {
    const session = await createSession({ userId: 'usr_1' });
    await revokeSession(session.id);
    await expect(validateSession(session.token)).rejects.toBeInstanceOf(SessionRevokedError);
    await expect(validateSession(session.token)).rejects.toMatchObject({
      message: `session revoked: ${session.id}`,
    });
  });

  it('throws when the session is already expired', async () => {
    const session = await createSession({ userId: 'usr_1', ttlDays: 0 });
    await expect(validateSession(session.token)).rejects.toBeInstanceOf(SessionExpiredError);
    await expect(validateSession(session.token)).rejects.toMatchObject({
      message: `session expired: ${session.id}`,
    });
  });
});

describe('revokeSession', () => {
  it('sets revokedAt on an existing session', async () => {
    const session = await createSession({ userId: 'usr_1' });
    await revokeSession(session.id);
    expect(session.revokedAt).toBeTypeOf('number');
    expect(session.revokedAt).toBeGreaterThanOrEqual(session.createdAt);
  });

  it('throws when the session id is unknown', async () => {
    await expect(revokeSession('sess_missing')).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});
