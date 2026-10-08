import type { Account } from "../lib/account-model";
import { getCurrentWindow } from "@tauri-apps/api/window";
export const desktopAccount: Account = {
  id: "desktop-poc",
  name: "Desktop POC",
  email: "local@desktop.invalid",
  role: "ADMIN",
};
export const getAccount = async () => desktopAccount;
export const login = async () => {
  throw new Error(
    "Desktop Foundation використовує окремий локальний тестовий профіль. Авторизацію не перенесено.",
  );
};
export const logout = async () => getCurrentWindow().close();
