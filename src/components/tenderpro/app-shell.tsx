import { useWorkspaceState } from "@/lib/workspace-state";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Box,
  ChevronLeft,
  ChevronRight,
  Download,
  Files,
  Menu,
  Settings,
  Tags,
  Upload,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DemoProvider } from "@/lib/demo-store";
import { Toaster } from "@/components/ui/sonner";

const navigation = [
  { to: "/tenders", label: "Тендери", Icon: Files },
  { to: "/dashboard", label: "Аналіз", Icon: BarChart3 },
  { to: "/inbox", label: "Імпорт / Джерела", Icon: Upload },
  { to: "/categories", label: "Категорії", Icon: Tags },
  { to: "/settings", label: "Налаштування", Icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useWorkspaceState(
    "sidebarCollapsed",
    false,
    (v) => typeof v === "boolean",
  );
  const path = useRouterState({ select: (s) => s.location.pathname });
  const worksheet = path === "/tenders" || path === "/tenders/";
  return (
    <DemoProvider>
      {worksheet ? (
        <main className="worksheet-main">{children}</main>
      ) : (
        <div className={`workspace-shell ${collapsed ? "nav-collapsed" : ""}`}>
          <aside className="workspace-nav">
            <Link to="/tenders" className="workspace-logo" title="TenderPro">
              <span className="sheet-mark">
                <Box />
              </span>
              {!collapsed && <strong>TenderPro</strong>}
            </Link>
            <button
              className="workspace-collapse"
              aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </button>
            <nav>
              {navigation.map(({ to, label, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  title={label}
                  className={cn(
                    "workspace-nav-item",
                    (path === to ||
                      (to === "/tenders" && path.startsWith("/tenders/"))) &&
                      "is-active",
                  )}
                >
                  <Icon />
                  {!collapsed && <span>{label}</span>}
                </Link>
              ))}
            </nav>
            {!collapsed && (
              <div className="workspace-secondary">
                <span>ІНШІ РОЗДІЛИ</span>
                <Link to="/analytics">
                  <BarChart3 />
                  Аналітика
                </Link>
                <Link to="/customers">
                  <Users />
                  Замовники
                </Link>
                <Link to="/export">
                  <Download />
                  Експорт
                </Link>
              </div>
            )}
            <Link to="/profile" className="workspace-user" title="Профіль">
              <span>ВМ</span>
              {!collapsed && (
                <div>
                  <b>Влад Михайлов</b>
                  <small>Адміністратор</small>
                </div>
              )}
            </Link>
          </aside>
          <div className="workspace-content">
            <header className="workspace-header">
              <button
                aria-label="Згорнути або розгорнути меню"
                onClick={() => setCollapsed((v) => !v)}
              >
                <Menu />
              </button>
              <span>
                Робочий простір <ChevronRight />{" "}
                <b>
                  {navigation.find((item) => item.to === path)?.label ??
                    "TenderPro"}
                </b>
              </span>
              <Link to="/tenders" className="workspace-return">
                <Files />
                До робочого листа
              </Link>
            </header>
            <main className="workspace-page">{children}</main>
          </div>
        </div>
      )}
      <Toaster richColors position="top-right" />
    </DemoProvider>
  );
}
