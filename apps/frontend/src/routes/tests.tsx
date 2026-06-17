import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tests")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/tests", search: { tab: "ohlc" } });
  },
});
