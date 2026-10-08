import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Account } from "./account-model.ts";
export type StoredAccount = Account & { passwordHash: string };
export interface AccountRepository {
  list(): Promise<StoredAccount[]>;
}
export class LocalAccountRepository implements AccountRepository {
  private path: string;
  constructor(directory = join(process.cwd(), ".tenderpro-local")) {
    this.path = join(directory, "auth-users.json");
  }
  async list(): Promise<StoredAccount[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8"));
      if (!Array.isArray(parsed.users) || parsed.users.length !== 2)
        throw new Error("Некоректна конфігурація акаунтів.");
      const users = parsed.users as StoredAccount[];
      for (const user of users)
        if (
          !["user", "admin"].includes(user.id) ||
          typeof user.email !== "string" ||
          typeof user.name !== "string" ||
          !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.passwordHash) ||
          user.role !== (user.id === "admin" ? "ADMIN" : "USER")
        )
          throw new Error("Некоректна конфігурація акаунтів.");
      if (
        new Set(users.map((u) => u.id)).size !== 2 ||
        new Set(users.map((u) => u.email.toLowerCase())).size !== 2
      )
        throw new Error("Некоректна конфігурація акаунтів.");
      return users;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error("Не вдалося прочитати локальні акаунти.");
    }
  }
  async seed(users: StoredAccount[]) {
    await mkdir(join(this.path, ".."), { recursive: true });
    // Never silently overwrite an existing user's password.
    await writeFile(
      this.path,
      JSON.stringify({ schemaVersion: 1, users }, null, 2),
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
  }
}
export type Session = { token: string; account: Account; expiresAt: number };
export interface SessionRepository {
  find(token: string): Promise<Session | null>;
  insert(session: Session): Promise<void>;
  delete(token: string): Promise<void>;
  deleteExpired(now: number): Promise<void>;
}
export class MemorySessionRepository implements SessionRepository {
  private sessions = new Map<string, Session>();
  async find(token: string) {
    const found = this.sessions.get(token);
    return found ? structuredClone(found) : null;
  }
  async insert(session: Session) {
    if (this.sessions.size >= 1000)
      this.sessions.delete(this.sessions.keys().next().value!);
    this.sessions.set(session.token, structuredClone(session));
  }
  async delete(token: string) {
    this.sessions.delete(token);
  }
  async deleteExpired(now: number) {
    for (const [token, session] of this.sessions)
      if (session.expiresAt <= now) this.sessions.delete(token);
  }
}
