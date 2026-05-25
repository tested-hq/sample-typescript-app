import { beforeEach, describe, expect, it } from 'vitest';
import { _resetSessions, createSession } from '../../src/auth/session.js';

beforeEach(() => {
  _resetSessions();
});

describe('createSession (happy path)', () => {
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
