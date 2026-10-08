import {
  getCookie,
  setCookie,
  deleteCookie,
  setResponseStatus,
  setResponseHeader,
} from "@tanstack/react-start/server";
import {
  LocalAccountRepository,
  MemorySessionRepository,
} from "./auth-repositories.server";
import { AuthService, SESSION_SECONDS } from "./auth-service.server";
const COOKIE = "tenderpro_session";
const auth = new AuthService(
  new LocalAccountRepository(),
  new MemorySessionRepository(),
);
export async function currentAccount() {
  setResponseHeader("Cache-Control", "private, no-store");
  return auth.currentAccount(getCookie(COOKIE));
}
export async function requireAccount(admin = false) {
  const account = await currentAccount();
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
export async function signIn(input: unknown) {
  setResponseHeader("Cache-Control", "private, no-store");
  const result = await auth.signIn(input, getCookie(COOKIE)).catch(() => {
    setResponseStatus(401);
    throw new Error("Невірний email або пароль");
  });
  const { token, account } = result;
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    secure: process.env["NODE_ENV"] === "production",
  });
  return account;
}
export async function signOut() {
  await auth.signOut(getCookie(COOKIE));
  deleteCookie(COOKIE, { path: "/" });
  setResponseHeader("Cache-Control", "private, no-store");
}
