// User CRUD layer. Acts as the boundary between the validation/persistence
// concerns and the rest of the app. Only `createUser` and `getUser` happy
// paths are covered by tests — update / delete / list and all error branches
// are deliberate `tested diff` targets.

import { InMemoryStore } from '../db/inMemoryStore.js';
import { validateEmail } from '../validation/email.js';
import { now } from '../util/clock.js';

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`user not found: ${id}`);
    this.name = 'UserNotFoundError';
  }
}

export class EmailInUseError extends Error {
  constructor(email: string) {
    super(`email already in use: ${email}`);
    this.name = 'EmailInUseError';
  }
}

export class InvalidEmailError extends Error {
  constructor(email: string) {
    super(`invalid email: ${email}`);
    this.name = 'InvalidEmailError';
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
}

export interface ListUsersOpts {
  limit?: number;
  offset?: number;
}

const store = new InMemoryStore<User>();
let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `usr_${idCounter}`;
}

export function _resetUsers(): void {
  store.clear();
  idCounter = 0;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  if (!validateEmail(input.email)) {
    throw new InvalidEmailError(input.email);
  }
  if (store.find((u) => u.email === input.email)) {
    throw new EmailInUseError(input.email);
  }
  const ts = now();
  const user: User = {
    id: nextId(),
    email: input.email,
    name: input.name,
    createdAt: ts,
    updatedAt: ts,
  };
  store.set(user.id, user);
  return user;
}

export async function getUser(id: string): Promise<User> {
  const user = store.get(id);
  if (!user) {
    throw new UserNotFoundError(id);
  }
  return user;
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<User> {
  const user = store.get(id);
  if (!user) {
    throw new UserNotFoundError(id);
  }
  if (patch.email !== undefined) {
    if (!validateEmail(patch.email)) {
      throw new InvalidEmailError(patch.email);
    }
    const conflict = store.find((u) => u.email === patch.email && u.id !== id);
    if (conflict) {
      throw new EmailInUseError(patch.email);
    }
    user.email = patch.email;
  }
  if (patch.name !== undefined) {
    user.name = patch.name;
  }
  user.updatedAt = now();
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  if (!store.has(id)) {
    throw new UserNotFoundError(id);
  }
  store.delete(id);
}

export async function listUsers(opts: ListUsersOpts = {}): Promise<User[]> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (limit < 0 || offset < 0) {
    throw new RangeError('limit and offset must be non-negative');
  }
  const sorted = store.list().sort((a, b) => a.createdAt - b.createdAt);
  return sorted.slice(offset, offset + limit);
}
