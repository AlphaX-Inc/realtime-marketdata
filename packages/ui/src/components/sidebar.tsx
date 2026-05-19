import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "../lib/utils";

export function SidebarProvider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-background text-foreground lg:grid-cols-[280px_1fr]",
        className,
      )}
      {...props}
    />
  );
}

export function Sidebar({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col border-b border-border bg-white text-zinc-950 lg:h-[100dvh] lg:border-b-0 lg:border-r",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 border-b border-border p-5", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 border-t border-border p-3", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-500",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("grid gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("min-w-0", className)} {...props} />;
}

export interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  isActive?: boolean;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-active={isActive}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-600 transition-[background-color,color,transform] duration-200 ease-out hover:bg-zinc-100 hover:text-zinc-950 active:translate-y-px data-[active=true]:bg-zinc-950 data-[active=true]:text-white",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn("min-w-0", className)} {...props} />;
}
