import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DemoProvider } from "@/lib/demo-store";
import { useAccount } from "@/lib/account";
import { Toaster } from "@/components/ui/sonner";
import { GlobalHotbar } from "./global-hotbar";
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
      <div className="global-workspace">
        <GlobalHotbar />
        <main className={worksheet ? "worksheet-main" : "application-page"}>
          {children}
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </DemoProvider>
  );
}
