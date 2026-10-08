import { randomBytes } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { LocalAccountRepository } from "../src/lib/auth-repositories.server.ts";
try {
  process.loadEnvFile(".env");
} catch {}
const generate = process.argv.includes("--generate");
const accounts = new LocalAccountRepository();
if ((await accounts.list()).length) {
  console.log("Акаунти вже створено; hashes не перезаписано.");
  process.exit(0);
}
const initialUser = process.env.TENDERPRO_USER_INITIAL_PASSWORD;
const initialAdmin = process.env.TENDERPRO_ADMIN_INITIAL_PASSWORD;
if (!generate && (!initialUser || !initialAdmin)) {
  console.error(
    "Задайте initial passwords через environment або використайте --generate.",
  );
  process.exit(1);
}
const userPassword = initialUser ?? randomBytes(24).toString("base64url");
const adminPassword = initialAdmin ?? randomBytes(24).toString("base64url");
if (
  [userPassword, adminPassword].some(
    (p) => !p.length || Buffer.byteLength(p, "utf8") > 72,
  )
) {
  console.error("Пароль має бути непорожнім і не перевищувати 72 UTF-8 bytes.");
  process.exit(1);
}
const adminEmail = (
  process.env.TENDERPRO_ADMIN_EMAIL ?? "admin@tenderpro.local"
)
  .trim()
  .toLowerCase();
if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) ||
  adminEmail === "pokotilova@euromash.com.ua"
) {
  console.error("Некоректний ADMIN identifier.");
  process.exit(1);
}
const users = [
  {
    id: "user",
    name: "Ганна Покотилова",
    email: "pokotilova@euromash.com.ua",
    role: "USER",
    passwordHash: await hash(userPassword, 12),
  },
  {
    id: "admin",
    name: "Влад",
    email: adminEmail,
    role: "ADMIN",
    passwordHash: await hash(adminPassword, 12),
  },
];
// A private delivery file is outside both the repository and Vite's workspace.
const directory = join(homedir(), ".codex", "secrets");
const privatePath = join(directory, "tenderpro-initial-credentials.txt");
if (generate) {
  await mkdir(directory, { recursive: true });
  try {
    await access(privatePath);
    console.error("Приватний файл уже існує; не перезаписано.");
    process.exit(1);
  } catch {}
  await writeFile(
    privatePath,
    `TenderPro — локальні початкові паролі\n\nГанна Покотилова / USER\nEmail: pokotilova@euromash.com.ua\nПароль: ${userPassword}\n\nВлад / ADMIN\nEmail: ${adminEmail}\nПароль: ${adminPassword}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
}
await accounts.seed(users);
console.log("Створено 2 локальні акаунти з password hashes.");
if (generate) console.log("Початкові паролі: " + privatePath);
