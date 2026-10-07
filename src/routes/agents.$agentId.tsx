import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";
import { AgentPage } from "@/components/tenderpro/agent-admin";
import { agentModules } from "@/lib/agent-presentation";
const parent = getRouteApi("/agents");
export const Route = createFileRoute("/agents/$agentId")({
  beforeLoad: ({ params }) => {
    if (!agentModules.some((a) => a.slug === params.agentId))
      throw redirect({ to: "/agents" });
  },
  component: () => {
    const { agentId } = Route.useParams();
    return (
      <AgentPage
        key={agentId}
        initial={parent.useLoaderData()}
        module={agentModules.find((a) => a.slug === agentId)!}
      />
    );
  },
});
