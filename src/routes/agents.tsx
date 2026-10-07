import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getAgentAdmin } from "@/lib/agents/client";
export const Route = createFileRoute("/agents")({
  beforeLoad: ({ context }) => {
    if (!context.account) throw redirect({ to: "/login" });
    if (context.account.role !== "ADMIN") throw redirect({ to: "/tenders" });
  },
  loader: () => getAgentAdmin(),
  component: () => <Outlet />,
});
