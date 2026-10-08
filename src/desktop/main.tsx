import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "../styles.css";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createHashHistory,
  RouterProvider,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AccountProvider } from "../lib/account";
import { AppShell } from "../components/tenderpro/app-shell";
import { Tenders, TenderDetail } from "../components/tenderpro/pages";
import { AccountSettings } from "../components/tenderpro/account-settings";
import { AgentHome, AgentPage } from "../components/tenderpro/agent-admin";
import { agentModules } from "../lib/agent-presentation";
import { getAgentAdmin } from "./features";
import { desktopAccount } from "./account";
import { desktopRepository, hydratePreferences } from "./repository";
import { initializeDesktopStore } from "./store";
const root = createRootRoute({
  component: () => (
    <AccountProvider account={desktopAccount}>
      <AppShell>
        <Outlet />
      </AppShell>
    </AccountProvider>
  ),
});
const index = createRoute({
  getParentRoute: () => root,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/tenders" });
  },
});
const table = createRoute({
  getParentRoute: () => root,
  path: "tenders",
  component: Tenders,
});
const card = createRoute({
  getParentRoute: () => root,
  path: "tenders/$id",
  component: () => <TenderDetail id={card.useParams().id} />,
});
const settings = createRoute({
  getParentRoute: () => root,
  path: "settings",
  component: AccountSettings,
});
const profile = createRoute({
  getParentRoute: () => root,
  path: "profile",
  beforeLoad: () => {
    throw redirect({ to: "/settings" });
  },
});
const login = createRoute({
  getParentRoute: () => root,
  path: "login",
  beforeLoad: () => {
    throw redirect({ to: "/tenders" });
  },
});
const agents = createRoute({
  getParentRoute: () => root,
  path: "agents",
  loader: () => getAgentAdmin(),
  component: Outlet,
});
const agentHome = createRoute({
  getParentRoute: () => agents,
  path: "/",
  component: () => <AgentHome initial={agents.useLoaderData()} />,
});
const agentPage = createRoute({
  getParentRoute: () => agents,
  path: "$agentId",
  component: () => {
    const module = agentModules.find(
      (a) => a.slug === agentPage.useParams().agentId,
    );
    return module ? (
      <AgentPage initial={agents.useLoaderData()} module={module} />
    ) : (
      <p>Агента не знайдено.</p>
    );
  },
});
const router = createRouter({
  history: createHashHistory(),
  routeTree: root.addChildren([
    index,
    table,
    card,
    settings,
    profile,
    login,
    agents.addChildren([agentHome, agentPage]),
  ]),
});
async function start() {
  const data = await desktopRepository.load();
  hydratePreferences(data);
  initializeDesktopStore(data);
  await getCurrentWindow().onCloseRequested(async (event) => {
    event.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
    window.dispatchEvent(new Event("pagehide"));
    try {
      await desktopRepository.flush();
      await getCurrentWindow().destroy();
    } catch (e) {
      window.alert(
        `Дані не збережено. Програма залишається відкритою: ${String(e)}`,
      );
    }
  });
  createRoot(document.getElementById("root")!).render(
    <RouterProvider router={router} />,
  );
}
void start().catch((error) => {
  const root = document.getElementById("root")!;
  root.textContent = `Desktop Foundation не запущено: ${String(error)}. Запустіть Windows EXE або npm run desktop:dev. Browser mock відсутній.`;
});
