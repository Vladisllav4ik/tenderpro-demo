import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AgentHome } from "@/components/tenderpro/agent-admin";
const parent = getRouteApi("/agents");
export const Route = createFileRoute("/agents/")({
  component: () => <AgentHome initial={parent.useLoaderData()} />,
});
