import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useMaterials, visibleForStudent } from "@/lib/materials-store";
import { MaterialLibrary } from "@/components/verbo/MaterialLibrary";

export const Route = createFileRoute("/student/resources")({ component: Page });

function Page() {
  const { user } = useAuth();
  const all = useMaterials();
  const items = useMemo(
    () => visibleForStudent(all, user?.product, user?.current_roadmap_level),
    [all, user?.product, user?.current_roadmap_level],
  );
  return <MaterialLibrary items={items} title="Resources" />;
}
