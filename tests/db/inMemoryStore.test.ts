import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../src/db/inMemoryStore.js';

describe('InMemoryStore', () => {
  it('set/get/has/delete operate on an isolated instance', () => {
    const store = new InMemoryStore<string>();
    const other = new InMemoryStore<string>();

    expect(store.has('a')).toBe(false);
    expect(store.get('a')).toBeUndefined();

    store.set('a', 'alpha');
    other.set('a', 'other');

    expect(store.has('a')).toBe(true);
    expect(store.get('a')).toBe('alpha');
    expect(other.get('a')).toBe('other');

    expect(store.delete('a')).toBe(true);
    expect(store.has('a')).toBe(false);
    expect(store.delete('a')).toBe(false);
    expect(other.get('a')).toBe('other');
  });

  it('clear, list, and size track the current entries', () => {
    const store = new InMemoryStore<number>();
    expect(store.size()).toBe(0);
    expect(store.list()).toEqual([]);

    store.set('one', 1);
    store.set('two', 2);
    expect(store.size()).toBe(2);
    expect(store.list()).toEqual([1, 2]);

    store.set('two', 22);
    expect(store.list()).toEqual([1, 22]);

    store.clear();
    expect(store.size()).toBe(0);
    expect(store.list()).toEqual([]);
    expect(store.get('one')).toBeUndefined();
  });

  it('find returns the first matching value or undefined', () => {
    const store = new InMemoryStore<{ id: string; n: number }>();
    store.set('a', { id: 'a', n: 1 });
    store.set('b', { id: 'b', n: 2 });
    store.set('c', { id: 'c', n: 2 });

    expect(store.find((v) => v.n === 2)).toEqual({ id: 'b', n: 2 });
    expect(store.find((v) => v.id === 'missing')).toBeUndefined();
  });
});
