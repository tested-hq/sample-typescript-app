import { describe, expect, it } from 'vitest';
import { validateEmail } from '../../src/validation/email.js';

describe('validateEmail', () => {
  it('accepts a typical address', () => {
    expect(validateEmail('alice@example.com')).toBe(true);
  });

  it('accepts plus-tags and subdomains', () => {
    expect(validateEmail('a.b+filter@mail.example.co.uk')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('rejects whitespace-only input', () => {
    expect(validateEmail('   ')).toBe(false);
  });

  it('rejects addresses without @', () => {
    expect(validateEmail('aliceexample.com')).toBe(false);
  });

  it('rejects addresses without a domain TLD', () => {
    expect(validateEmail('alice@example')).toBe(false);
  });

  it('rejects addresses with leading or trailing whitespace', () => {
    expect(validateEmail(' alice@example.com')).toBe(false);
    expect(validateEmail('alice@example.com ')).toBe(false);
  });

  it('rejects addresses with consecutive dots in the local part', () => {
    expect(validateEmail('a..b@example.com')).toBe(false);
  });

  it('rejects addresses longer than the RFC 5321 cap', () => {
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(63)}.com`;
    const tooLong = `${local}@${domain}${'c'.repeat(256)}`;
    expect(validateEmail(tooLong)).toBe(false);
  });

  it('rejects non-string input defensively', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateEmail(123 as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateEmail(null as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateEmail(undefined as any)).toBe(false);
  });
});
