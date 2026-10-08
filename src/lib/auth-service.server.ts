import { randomBytes } from "node:crypto";
import { compare, hashSync } from "bcryptjs";
import type { Account } from "./account-model.ts";
import type {
  AccountRepository,
  SessionRepository,
  StoredAccount,
} from "./auth-repositories.server.ts";
export const AUTH_ERROR = "Невірний email або пароль";
export const SESSION_SECONDS = 12 * 60 * 60;
export const safeAccount = (account: StoredAccount): Account => ({
  id: account.id,
  name: account.name,
  email: account.email,
  role: account.role,
});
export class AuthService {
  private accounts: AccountRepository;
  private sessions: SessionRepository;
  private now: () => number;
  private dummyHash: string;
  constructor(
    accounts: AccountRepository,
    sessions: SessionRepository,
    now = () => Date.now(),
  ) {
    this.accounts = accounts;
    this.sessions = sessions;
    this.now = now;
    this.dummyHash = hashSync(randomBytes(24).toString("base64url"), 12);
  }
  async signIn(input: unknown, oldToken?: string) {
    if (!input || typeof input !== "object") throw new Error(AUTH_ERROR);
    const { email, password } = input as Record<string, unknown>;
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      !password.length ||
      Buffer.byteLength(password, "utf8") > 72
    )
      throw new Error(AUTH_ERROR);
    const normalized = email.trim().toLowerCase();
    const user = (await this.accounts.list()).find(
      (a) => a.email.trim().toLowerCase() === normalized,
    );
    const valid = await compare(password, user?.passwordHash ?? this.dummyHash);
    if (!user || !valid) throw new Error(AUTH_ERROR);
    const account = safeAccount(user),
      token = randomBytes(32).toString("base64url");
    if (oldToken) await this.sessions.delete(oldToken);
    await this.sessions.deleteExpired(this.now());
    await this.sessions.insert({
      token,
      account,
      expiresAt: this.now() + SESSION_SECONDS * 1000,
    });
    return { token, account };
  }
  async currentAccount(token?: string): Promise<Account | null> {
    if (!token) return null;
    const session = await this.sessions.find(token);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      await this.sessions.delete(token);
      return null;
    }
    return session.account;
  }
  async signOut(token?: string) {
    if (token) await this.sessions.delete(token);
  }
}
