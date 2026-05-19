import { BookOpenText, Broadcast, Key, SignOut, UsersThree } from "@phosphor-icons/react";
import { Button } from "@realtime-pricing/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@realtime-pricing/ui/components/sidebar";
import { Skeleton } from "@realtime-pricing/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { getCurrentUser, logout } from "@/lib/api";

const navItems = [
  {
    to: "/dashboard/users",
    label: "User List",
    icon: UsersThree,
  },
  {
    to: "/dashboard/api-keys",
    label: "Api Key",
    icon: Key,
  },
  {
    to: "/dashboard/docs",
    label: "Docs",
    icon: BookOpenText,
  },
  {
    to: "/dashboard/logs",
    label: "Logs",
    icon: Broadcast,
  },
] as const;

export function DashboardLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/login" });
    },
  });

  if (meQuery.isLoading) {
    return (
      <main className="h-[100dvh] bg-background">
        <div className="grid h-[100dvh] w-full overflow-hidden lg:grid-cols-[280px_1fr]">
          <Skeleton className="hidden h-[100dvh] rounded-none border-r bg-white lg:block" />
          <div className="space-y-5 p-5 md:p-6">
            <Skeleton className="h-24 border bg-white" />
            <Skeleton className="h-[520px] border bg-white" />
          </div>
        </div>
      </main>
    );
  }

  if (meQuery.isError) {
    void navigate({ to: "/login" });
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-zinc-950 text-sm font-semibold text-white">
              RP
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-950">Realtime Pricing</p>
              <p className="mt-0.5 text-xs text-zinc-500">Market data gateway</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Console</SidebarGroupLabel>
            <SidebarMenu className="mt-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.to;

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.to} activeOptions={{ exact: true }}>
                        <Icon className="size-4" weight={isActive ? "fill" : "regular"} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="mb-3 rounded-lg bg-zinc-50 p-3">
            <p className="truncate text-sm font-semibold text-zinc-950">
              {meQuery.data?.user.name}
            </p>
            <p className="truncate text-xs text-zinc-500">{meQuery.data?.user.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <SignOut className="size-4" />
            Sign out
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background">
        <div className="h-[100dvh] overflow-y-auto px-4 py-5 md:px-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
