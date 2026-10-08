import { LocalPreferencesRepository } from "./preferences-repository";
import { createContext, useContext, type ReactNode } from "react";
import type { Account } from "./account-model";
export type { Account } from "./account-model";
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
