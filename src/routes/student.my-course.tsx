import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/verbo/ComingSoon";

export const Route = createFileRoute("/student/my-course")({
  component: () => <ComingSoon title="My Course" />,
});
