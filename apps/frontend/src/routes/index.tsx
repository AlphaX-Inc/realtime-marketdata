import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/api";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData({
        queryKey: ["auth", "me"],
        queryFn: getCurrentUser,
      });
      throw redirect({ to: "/dashboard" });
    } catch {
      throw redirect({ to: "/login" });
    }
  },
});
