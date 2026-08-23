import { beforeEach, describe, expect, it } from 'vitest';
import {
  EmailInUseError,
  InvalidEmailError,
  UserNotFoundError,
  _resetUsers,
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../../src/api/users.js';

beforeEach(() => {
  _resetUsers();
});

describe('createUser', () => {
  it('persists a user with valid input', async () => {
    const user = await createUser({ email: 'alice@example.com', name: 'Alice' });
    expect(user.id).toMatch(/^usr_\d+$/);
    expect(user.email).toBe('alice@example.com');
    expect(user.name).toBe('Alice');
    expect(user.updatedAt).toBe(user.createdAt);
  });

  it('rejects an invalid email', async () => {
    await expect(createUser({ email: 'not-an-email', name: 'X' })).rejects.toBeInstanceOf(
      InvalidEmailError,
    );
    await expect(createUser({ email: 'not-an-email', name: 'X' })).rejects.toMatchObject({
      message: 'invalid email: not-an-email',
    });
  });

  it('rejects a duplicate email', async () => {
    await createUser({ email: 'alice@example.com', name: 'Alice' });
    await expect(
      createUser({ email: 'alice@example.com', name: 'Other' }),
    ).rejects.toBeInstanceOf(EmailInUseError);
  });
});

describe('getUser', () => {
  it('retrieves a previously created user by id', async () => {
    const created = await createUser({ email: 'bob@example.com', name: 'Bob' });
    const fetched = await getUser(created.id);
    expect(fetched).toEqual(created);
  });

  it('throws when the id is missing', async () => {
    await expect(getUser('usr_missing')).rejects.toBeInstanceOf(UserNotFoundError);
    await expect(getUser('usr_missing')).rejects.toMatchObject({
      message: 'user not found: usr_missing',
    });
  });
});

describe('updateUser', () => {
  it('patches name and/or email and bumps updatedAt', async () => {
    const created = await createUser({ email: 'cara@example.com', name: 'Cara' });
    const renamed = await updateUser(created.id, { name: 'Caroline' });
    expect(renamed.name).toBe('Caroline');
    expect(renamed.email).toBe('cara@example.com');
    expect(renamed.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);

    const remailed = await updateUser(created.id, { email: 'caroline@example.com' });
    expect(remailed.email).toBe('caroline@example.com');
    expect(remailed.name).toBe('Caroline');
  });

  it('allows updating email to the same address', async () => {
    const created = await createUser({ email: 'same@example.com', name: 'S' });
    const updated = await updateUser(created.id, { email: 'same@example.com' });
    expect(updated.email).toBe('same@example.com');
  });

  it('throws when the user does not exist', async () => {
    await expect(updateUser('usr_missing', { name: 'X' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('rejects an invalid replacement email', async () => {
    const created = await createUser({ email: 'ok@example.com', name: 'Ok' });
    await expect(updateUser(created.id, { email: 'bad' })).rejects.toBeInstanceOf(
      InvalidEmailError,
    );
  });

  it('rejects an email already used by another user', async () => {
    await createUser({ email: 'one@example.com', name: 'One' });
    const two = await createUser({ email: 'two@example.com', name: 'Two' });
    await expect(updateUser(two.id, { email: 'one@example.com' })).rejects.toBeInstanceOf(
      EmailInUseError,
    );
  });
});

describe('deleteUser', () => {
  it('removes an existing user', async () => {
    const created = await createUser({ email: 'del@example.com', name: 'Del' });
    await deleteUser(created.id);
    await expect(getUser(created.id)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('throws when the user does not exist', async () => {
    await expect(deleteUser('usr_missing')).rejects.toBeInstanceOf(UserNotFoundError);
  });
});

describe('listUsers', () => {
  it('returns users in createdAt order with default paging', async () => {
    const a = await createUser({ email: 'a@example.com', name: 'A' });
    const b = await createUser({ email: 'b@example.com', name: 'B' });
    await expect(listUsers()).resolves.toEqual([a, b]);
  });

  it('honors limit and offset', async () => {
    const a = await createUser({ email: 'a@example.com', name: 'A' });
    const b = await createUser({ email: 'b@example.com', name: 'B' });
    const c = await createUser({ email: 'c@example.com', name: 'C' });
    await expect(listUsers({ limit: 1 })).resolves.toEqual([a]);
    await expect(listUsers({ offset: 1, limit: 1 })).resolves.toEqual([b]);
    await expect(listUsers({ offset: 2 })).resolves.toEqual([c]);
  });

  it('rejects negative limit or offset', async () => {
    await expect(listUsers({ limit: -1 })).rejects.toBeInstanceOf(RangeError);
    await expect(listUsers({ offset: -1 })).rejects.toThrow(/non-negative/);
  });
});
