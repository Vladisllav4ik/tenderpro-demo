import { createFileRoute } from "@tanstack/react-router";
import { TenderDetail } from "@/components/tenderpro/pages";
export const Route = createFileRoute("/tenders/$id")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  return <TenderDetail key={id} id={id} />;
}
