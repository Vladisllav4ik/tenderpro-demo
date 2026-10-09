import { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAccount } from "@/lib/account";
import { logout } from "@/lib/account-session";
import { useWorkspaceState } from "@/lib/workspace-state";
export function AccountSettings() {
  const account = useAccount()!;

  const [name, setName, nameReady] = useWorkspaceState(
    "profileName",
    account.name,
    (v) => typeof v === "string",
  );
  useEffect(() => {
    if (
      nameReady &&
      ["Директор", "Другий користувач", "Адміністратор"].includes(name)
    )
      setName(account.name);
  }, [nameReady, name, account.name, setName]);
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
    <section className="admin-page settings-page">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">APPLICATION PREFERENCES</p>
          <h1>Налаштування</h1>
          <p>Персональний вигляд робочого простору</p>
        </div>
      </header>
      <Tabs defaultValue="profile" className="admin-tabs">
        <TabsList aria-label="Розділи налаштувань">
          <TabsTrigger value="profile">Профіль</TabsTrigger>
          <TabsTrigger value="table">Таблиця</TabsTrigger>
          <TabsTrigger value="personal">Інтерфейс</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="admin-panel space-y-4">
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
              {account.email} · {account.role}
            </p>
            <p className="text-sm text-muted-foreground">
              Персональні налаштування зберігаються у цьому браузері для вашого
              акаунта.
            </p>
            {!account.authDisabled && <button
              className="rounded border px-4 py-2"
              onClick={async () => {
                await logout();
                window.location.assign("/login");
              }}
            >
              Вийти
            </button>}
          </div>
        </TabsContent>
        <TabsContent value="table">
          <div className="admin-panel space-y-4">
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
        </TabsContent>
        <TabsContent value="personal">
          <div className="admin-panel space-y-4">
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
        </TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        Зміни зберігаються автоматично.
      </p>
    </section>
  );
}
