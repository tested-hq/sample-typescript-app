import { beforeEach, describe, expect, it } from 'vitest';
import { _resetUsers, createUser, getUser } from '../../src/api/users.js';

beforeEach(() => {
  _resetUsers();
});

describe('createUser (happy path)', () => {
  it('persists a user with valid input', async () => {
    const user = await createUser({ email: 'alice@example.com', name: 'Alice' });
    expect(user.id).toMatch(/^usr_\d+$/);
    expect(user.email).toBe('alice@example.com');
    expect(user.name).toBe('Alice');
    expect(user.updatedAt).toBe(user.createdAt);
  });
});

describe('getUser (happy path)', () => {
  it('retrieves a previously created user by id', async () => {
    const created = await createUser({ email: 'bob@example.com', name: 'Bob' });
    const fetched = await getUser(created.id);
    expect(fetched).toEqual(created);
  });
});
