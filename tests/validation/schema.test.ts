import { describe, expect, it } from 'vitest';
import {
  PayloadValidationError,
  validateUserPayload,
} from '../../src/validation/schema.js';

describe('validateUserPayload', () => {
  it('accepts a human user payload', () => {
    expect(
      validateUserPayload({
        kind: 'human',
        email: 'alice@example.com',
        displayName: 'Alice',
      }),
    ).toEqual({
      kind: 'human',
      email: 'alice@example.com',
      displayName: 'Alice',
    });
  });

  it('accepts a service user payload', () => {
    expect(
      validateUserPayload({
        kind: 'service',
        team: 'platform',
        apiKeyLabel: 'ci-bot',
      }),
    ).toEqual({
      kind: 'service',
      team: 'platform',
      apiKeyLabel: 'ci-bot',
    });
  });

  it('throws PayloadValidationError with issues when required fields are missing', () => {
    expect(() => validateUserPayload({ kind: 'human' })).toThrow(PayloadValidationError);

    try {
      validateUserPayload({ kind: 'human' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PayloadValidationError);
      const error = err as PayloadValidationError;
      expect(error.issues.length).toBeGreaterThan(0);
      expect(error.message).toMatch(/email|displayName/);
    }
  });

  it('throws with issues for a service payload missing fields', () => {
    try {
      validateUserPayload({ kind: 'service' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PayloadValidationError);
      const error = err as PayloadValidationError;
      expect(error.issues.length).toBeGreaterThan(0);
      expect(error.message).toMatch(/team|apiKeyLabel/);
    }
  });

  it('rejects an unknown kind and empty values', () => {
    expect(() => validateUserPayload({ kind: 'bot' })).toThrow(PayloadValidationError);
    expect(() =>
      validateUserPayload({ kind: 'human', email: '', displayName: 'A' }),
    ).toThrow(PayloadValidationError);
    expect(() =>
      validateUserPayload({ kind: 'service', team: '', apiKeyLabel: 'x' }),
    ).toThrow(PayloadValidationError);
    expect(() => validateUserPayload(null)).toThrow(PayloadValidationError);
  });
});
