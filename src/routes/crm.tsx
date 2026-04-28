import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/crm")({
  component: CrmLayout,
});

function CrmLayout() {
  return <Outlet />;
}
