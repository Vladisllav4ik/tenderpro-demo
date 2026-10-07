import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Box, Files, Settings, Bot } from "lucide-react";
import { DemoProvider } from "@/lib/demo-store";
import { useAccount } from "@/lib/account";
import { Toaster } from "@/components/ui/sonner";
export function AppShell({ children }: { children: ReactNode }) {
  const account = useAccount();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!account || path === "/login")
    return (
      <>
        {children}
        <Toaster richColors />
      </>
    );
  const worksheet = path === "/tenders" || path === "/tenders/";
  return (
    <DemoProvider key={account.id}>
      {worksheet ? (
        <main className="worksheet-main">{children}</main>
      ) : (
        <div className="workspace-shell">
          <aside className="workspace-nav">
            <Link to="/tenders" className="workspace-logo" title="TenderPro">
              <span className="sheet-mark">
                <Box />
              </span>
              <strong>TenderPro</strong>
            </Link>
            <nav>
              <Link
                className={`workspace-nav-item ${path.startsWith("/tenders/") ? "is-active" : ""}`}
                to="/tenders"
                title="Тендери"
              >
                <Files />
                <span>Тендери</span>
              </Link>
              <Link
                className={`workspace-nav-item ${path === "/settings" ? "is-active" : ""}`}
                to="/settings"
                title="Налаштування"
              >
                <Settings />
                <span>Налаштування</span>
              </Link>
              {account.role === "ADMIN" && (
                <Link
                  className={`workspace-nav-item ${path === "/agents" ? "is-active" : ""}`}
                  to="/agents"
                  title="AI Агенти"
                >
                  <Bot />
                  <span>AI Агенти</span>
                </Link>
              )}
            </nav>
            <Link
              className="workspace-user"
              to="/settings"
              title={account.name}
            >
              <span>{account.role === "ADMIN" ? "А" : "Д"}</span>
              <div>
                <b>{account.name}</b>
                <small>{account.role} · demo</small>
              </div>
            </Link>
          </aside>
          <div className="workspace-content">
            <header className="workspace-header">
              <span>TenderPro · {account.name}</span>
              <Link to="/tenders" className="workspace-return">
                <Files />
                До таблиці
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
