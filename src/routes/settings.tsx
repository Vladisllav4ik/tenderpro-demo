import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountSettings } from "@/components/tenderpro/account-settings";
export const Route = createFileRoute("/settings")({
  beforeLoad: ({ context }) => {
    if (!context.account) throw redirect({ to: "/login" });
  },
  component: AccountSettings,
});
