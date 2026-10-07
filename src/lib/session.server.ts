import { randomUUID } from "node:crypto";
import {
  getCookie,
  setCookie,
  deleteCookie,
  setResponseStatus,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { demoAccounts, type Account } from "./account";
// Demo-only opaque sessions. Replace this adapter with production auth before real accounts.
const sessions = new Map<string, { account: Account; expires: number }>();
export function currentAccount() {
  setResponseHeader("Cache-Control", "private, no-store");
  const token = getCookie("tenderpro_demo_session");
  const session = token ? sessions.get(token) : undefined;
  return session && session.expires > Date.now() ? session.account : null;
}
export function requireAccount(admin = false) {
  const account = currentAccount();
  if (!account) {
    setResponseStatus(401);
    throw new Error("Потрібен вхід");
  }
  if (admin && account.role !== "ADMIN") {
    setResponseStatus(403);
    throw new Error("Доступ лише для ADMIN");
  }
  return account;
}
export function signIn(id: string) {
  const account = demoAccounts.find((a) => a.id === id);
  if (!account) throw new Error("Невідомий демо-акаунт");
  const old = getCookie("tenderpro_demo_session");
  if (old) sessions.delete(old);
  const token = randomUUID();
  for (const [key, value] of sessions)
    if (value.expires < Date.now()) sessions.delete(key);
  if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value!);
  sessions.set(token, { account, expires: Date.now() + 86400000 });
  setCookie("tenderpro_demo_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
    secure: process.env["NODE_ENV"] === "production",
  });
  return account;
}
export function signOut() {
  const token = getCookie("tenderpro_demo_session");
  if (token) sessions.delete(token);
  deleteCookie("tenderpro_demo_session", { path: "/" });
}
