import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/verbo/ComingSoon";

export const Route = createFileRoute("/student/insights")({
  component: () => <ComingSoon title="Insights" />,
});
