import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/optimization")({
  component: () => <Navigate to="/admin/optimization" />,
});
