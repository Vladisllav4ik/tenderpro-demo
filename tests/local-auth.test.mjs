import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import {
  LocalAccountRepository,
  MemorySessionRepository,
} from "../src/lib/auth-repositories.server.ts";
import {
  AuthService,
  AUTH_ERROR,
  SESSION_SECONDS,
} from "../src/lib/auth-service.server.ts";
import { accountInitials } from "../src/lib/account-model.ts";
import { crashAccountView } from "../src/lib/crash-account-view.ts";
import { LocalPreferencesRepository } from "../src/lib/preferences-repository.ts";
async function fixture(work) {
  const directory = await mkdtemp(join(tmpdir(), "tenderpro-auth-"));
  try {
    const passwords = [
      randomBytes(24).toString("base64url"),
      randomBytes(24).toString("base64url"),
    ];
    const users = [
      {
        id: "user",
        name: "Ганна Покотилова",
        email: "pokotilova@euromash.com.ua",
        role: "USER",
        passwordHash: await hash(passwords[0], 4),
      },
      {
        id: "admin",
        name: "Влад",
        email: "admin@tenderpro.local",
        role: "ADMIN",
        passwordHash: await hash(passwords[1], 4),
      },
    ];
    const repo = new LocalAccountRepository(directory);
    await repo.seed(users);
    const sessions = new MemorySessionRepository();
    let now = 1000;
    const auth = new AuthService(repo, sessions, () => now);
    await work({
      directory,
      passwords,
      users,
      repo,
      sessions,
      auth,
      advance: (ms) => (now += ms),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test("Two local users verify normalized emails; only safe fields leave the auth service", async () =>
  fixture(async ({ auth, passwords, users, directory, repo }) => {
    for (let i = 0; i < 2; i++) {
      const reply = await auth.signIn({
        email: ` ${users[i].email.toUpperCase()} `,
        password: passwords[i],
        role: "ADMIN",
      });
      assert.equal(reply.account.role, users[i].role);
      assert.deepEqual(Object.keys(reply.account).sort(), [
        "email",
        "id",
        "name",
        "role",
      ]);
      assert.equal(
        (await auth.currentAccount(reply.token)).name,
        users[i].name,
      );
      assert.equal(reply.token.length, 43);
    }
    const stored = await readFile(join(directory, "auth-users.json"), "utf8");
    for (const password of passwords)
      assert.equal(stored.includes(password), false);
    assert.match(stored, /passwordHash/);
    assert.equal((await repo.list()).length, 2);
    await assert.rejects(repo.seed(users), /EEXIST/);
  }));
test("Wrong email, wrong password, ID-only demo login and oversized bcrypt input all fail uniformly", async () =>
  fixture(async ({ auth, passwords, users }) => {
    for (const input of [
      { email: "unknown@example.invalid", password: passwords[0] },
      {
        email: users[0].email,
        password: randomBytes(24).toString("base64url"),
      },
      "admin",
      { email: users[0].email, password: "я".repeat(40) },
    ])
      await assert.rejects(auth.signIn(input), (e) => e.message === AUTH_ERROR);
  }));
test("Opaque sessions survive repeated reads, rotate on login, expire and are invalidated by logout", async () =>
  fixture(async ({ auth, passwords, users, advance }) => {
    const first = await auth.signIn({
      email: users[0].email,
      password: passwords[0],
    });
    assert.equal((await auth.currentAccount(first.token)).id, "user");
    assert.equal((await auth.currentAccount(first.token)).id, "user");
    const second = await auth.signIn(
      { email: users[1].email, password: passwords[1] },
      first.token,
    );
    assert.equal(await auth.currentAccount(first.token), null);
    assert.equal((await auth.currentAccount(second.token)).id, "admin");
    await auth.signOut(second.token);
    assert.equal(await auth.currentAccount(second.token), null);
    const third = await auth.signIn({
      email: users[0].email,
      password: passwords[0],
    });
    advance(SESSION_SECONDS * 1000);
    assert.equal(await auth.currentAccount(third.token), null);
    assert.equal(await auth.currentAccount("invalid"), null);
  }));
test("Account-specific preferences remain isolated for all table settings and initials match real users", () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
  const repo = new LocalPreferencesRepository(storage);
  for (const setting of [
    "zoom",
    "compactLayout",
    "detailedLayout",
    "filters",
    "detailMode",
    "aiVisible",
    "dateRange",
  ]) {
    repo.write("user", `table.${setting}`, { owner: "user" });
    repo.write("admin", `table.${setting}`, { owner: "admin" });
    assert.deepEqual(repo.read("user", `table.${setting}`, null), {
      owner: "user",
    });
    assert.deepEqual(repo.read("admin", `table.${setting}`, null), {
      owner: "admin",
    });
  }
  assert.equal(accountInitials("Ганна Покотилова"), "ГП");
  assert.equal(accountInitials("Влад"), "В");
});
test("USER crash response preserves final tender but excludes technical agent results, logs and source registry", () => {
  const record = {
    finalMergedTender: { id: "UA-test", aiSummary: "Source confirmed" },
    agent2Result: { private: "technical" },
    agent3Result: { private: "technical" },
    agent4Result: { private: "technical" },
    pipeline: { runs: [{ totalTokens: 123 }] },
    preparation: { documents: ["private cache"] },
    agent3Debug: { documentsConsumed: 1 },
    mergeWarnings: ["technical"],
  };
  const view = crashAccountView(record, "USER");
  assert.equal(view.finalMergedTender, record.finalMergedTender);
  assert.equal(view.pipeline, null);
  assert.equal(view.agent3Result, null);
  assert.equal("preparation" in view, false);
  assert.equal("agent3Debug" in view, false);
  assert.equal(crashAccountView(record, "ADMIN"), record);
});
