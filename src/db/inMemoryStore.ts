// Generic Map-backed store. Used by both `users` and `orders` modules as a
// stand-in for whatever real persistence layer the host project would use.
// Exposed as a class so tests can spin up isolated instances per `describe`.

export class InMemoryStore<T> {
  private readonly data = new Map<string, T>();

  set(key: string, value: T): void {
    this.data.set(key, value);
  }

  get(key: string): T | undefined {
    return this.data.get(key);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  list(): T[] {
    return Array.from(this.data.values());
  }

  size(): number {
    return this.data.size;
  }

  /**
   * Returns the first entry whose value satisfies `predicate`, or `undefined`.
   * Useful for "find by secondary attribute" lookups (e.g. user-by-email).
   */
  find(predicate: (value: T) => boolean): T | undefined {
    for (const value of this.data.values()) {
      if (predicate(value)) return value;
    }
    return undefined;
  }
}
