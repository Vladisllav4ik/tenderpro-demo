export const accountKey = (id: string, name: string) =>
  `tenderpro.users.${id}.${name}`;
export interface UserPreferencesRepository {
  read<T>(id: string, name: string, fallback: T): T;
  write(id: string, name: string, value: unknown): void;
}
export class LocalPreferencesRepository implements UserPreferencesRepository {
  private storage: Storage;
  constructor(storage: Storage) {
    this.storage = storage;
  }
  read<T>(id: string, name: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(accountKey(id, name));
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  write(id: string, name: string, value: unknown) {
    this.storage.setItem(accountKey(id, name), JSON.stringify(value));
  }
  migrate(id: string) {
    if (id !== "user" || this.storage.getItem(accountKey(id, "migrated")))
      return;
    for (let i = this.storage.length - 1; i >= 0; i--) {
      const key = this.storage.key(i)!;
      const name =
        key === "tenderpro-demo"
          ? "tenders"
          : key.startsWith("tenderpro.table.")
            ? `table.${key.slice("tenderpro.table.".length)}`
            : null;
      if (name && this.storage.getItem(accountKey(id, name)) === null)
        this.storage.setItem(accountKey(id, name), this.storage.getItem(key)!);
    }
    this.storage.setItem(accountKey(id, "migrated"), "true");
  }
}
