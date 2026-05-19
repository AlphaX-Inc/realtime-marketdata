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
    label: "Users",
    icon: UsersThree,
  },
  {
    to: "/dashboard/api-keys",
    label: "API keys",
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
        <div className="grid h-[100dvh] w-full overflow-hidden lg:grid-cols-[292px_1fr]">
          <Skeleton className="hidden h-[100dvh] rounded-none border-r bg-card/80 lg:block" />
          <div className="space-y-5 p-5 md:p-6">
            <Skeleton className="h-24 border bg-card/70" />
            <Skeleton className="h-[520px] border bg-card/70" />
          </div>
        </div>
      </main>
    );
  }

  if (meQuery.isError) {
    void navigate({ to: "/login" });
    return null;
  }

  const user = meQuery.data?.user;
  const initials =
    user?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground shadow-[0_12px_28px_hsl(160_31%_28%_/_0.22)]">
              AX
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-950">AlphaX</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Market data</p>
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
          <div className="mb-2 rounded-lg border border-white/70 bg-gradient-to-br from-card/95 to-secondary/55 p-3 shadow-[0_12px_32px_hsl(230_12%_11%_/_0.06),0_1px_0_hsl(0_0%_100%_/_0.88)_inset]">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-xs font-bold text-primary shadow-[0_1px_0_hsl(0_0%_100%_/_0.78)_inset]">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold leading-5 text-zinc-950">
                    {user?.name}
                  </p>
                  <span className="shrink-0 rounded-[0.3rem] bg-primary/10 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-primary">
                    Admin
                  </span>
                </div>
                <p className="truncate text-xs leading-5 text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-between rounded-md px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <span>{logoutMutation.isPending ? "Signing out" : "Sign out"}</span>
            <SignOut className="size-4" />
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <div className="h-[100dvh] overflow-y-auto px-4 py-5 md:px-7 lg:px-9">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
