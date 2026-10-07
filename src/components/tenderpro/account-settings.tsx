import { useAccount } from "@/lib/account";
import { logout } from "@/lib/account-session";
import { useWorkspaceState } from "@/lib/workspace-state";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
export function AccountSettings() {
  const account = useAccount()!;
  const [tab, setTab] = useState("profile");
  const [name, setName] = useWorkspaceState(
    "profileName",
    account.name,
    (v) => typeof v === "string",
  );
  const [zoom, setZoom] = useWorkspaceState("zoom", 100, (v) =>
    [100, 125, 150, 175, 200].includes(v as number),
  );
  const [ai, setAi] = useWorkspaceState(
    "aiVisible",
    true,
    (v) => typeof v === "boolean",
  );
  const [fullscreen, setFullscreen] = useWorkspaceState(
    "fullscreenPreferred",
    false,
    (v) => typeof v === "boolean",
  );
  const [personal, setPersonal] = useWorkspaceState("personal", {
    locale: "uk-UA",
    timezone: "Europe/Kyiv",
  });
  return (
    <section className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Налаштування</h1>
      <div className="flex gap-2">
        {[
          ["profile", "Профіль"],
          ["table", "Таблиця / вигляд"],
          ["personal", "Персональні налаштування"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id!)}
            className={`rounded border px-4 py-2 ${tab === id ? "bg-primary text-primary-foreground" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "profile" && (
        <div className="space-y-4">
          <label className="block">
            Ім’я
            <input
              className="mt-2 block rounded border p-2"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p>
            Акаунт: {account.id} · {account.role}
          </p>
          <p className="text-sm text-muted-foreground">
            Демо-сесія. Персональні дані зберігаються у цьому браузері.
          </p>
          <button
            className="rounded border px-4 py-2"
            onClick={async () => {
              await logout();
              window.location.assign("/login");
            }}
          >
            Вийти
          </button>
        </div>
      )}
      {tab === "table" && (
        <div className="space-y-4">
          <label className="block">
            Масштаб{" "}
            <select
              className="rounded border p-2"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              {[100, 125, 150, 175, 200].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={ai}
              onChange={(e) => setAi(e.target.checked)}
            />{" "}
            Показувати AI
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={fullscreen}
              onChange={(e) => setFullscreen(e.target.checked)}
            />{" "}
            Пропонувати повний екран
          </label>
          <p>
            Порядок, ширина, закріплення та видимість колонок налаштовуються у
            таблиці окремо для кожного режиму.
          </p>
        </div>
      )}
      {tab === "personal" && (
        <div className="space-y-4">
          <p>Мова: українська</p>
          <label>
            Часовий пояс{" "}
            <select
              value={personal.timezone}
              onChange={(e) =>
                setPersonal({ ...personal, timezone: e.target.value })
              }
            >
              <option value="Europe/Kyiv">Europe/Kyiv</option>
            </select>
          </label>
          <p>
            Період, фільтри, сортування, вибраний тендер і позиція прокрутки
            зберігаються для вашого акаунта.
          </p>
        </div>
      )}
      {account.role === "ADMIN" && (
        <Link className="block text-primary" to="/agents">
          AI Агенти →
        </Link>
      )}
      <p className="text-sm text-muted-foreground">
        Зміни зберігаються автоматично.
      </p>
    </section>
  );
}
