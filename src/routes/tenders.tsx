import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/tenders")({
  beforeLoad: ({ context }) => {
    if (!context.account) throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
