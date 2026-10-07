import { LocalPreferencesRepository } from "./preferences-repository";
import { createContext, useContext, type ReactNode } from "react";
export type Account = { id: string; name: string; role: "USER" | "ADMIN" };
export const demoAccounts: Account[] = [
  { id: "user", name: "Директор", role: "USER" },
  { id: "user2", name: "Другий користувач", role: "USER" },
  { id: "admin", name: "Адміністратор", role: "ADMIN" },
];
const Context = createContext<Account | null>(null);
export function AccountProvider({
  account,
  children,
}: {
  account: Account | null;
  children: ReactNode;
}) {
  return <Context.Provider value={account}>{children}</Context.Provider>;
}
export function useAccount() {
  return useContext(Context);
}
export { accountKey } from "./preferences-repository";
export function migrateAccountStorage(id: string) {
  try {
    new LocalPreferencesRepository(localStorage).migrate(id);
  } catch {}
}
