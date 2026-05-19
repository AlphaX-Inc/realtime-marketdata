import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "../lib/utils";

export function SidebarProvider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-background text-foreground lg:grid-cols-[292px_1fr]",
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
        "relative flex min-h-0 flex-col overflow-hidden border-b border-border/70 bg-card/82 text-zinc-950 shadow-[18px_0_55px_hsl(230_12%_11%_/_0.08),0_1px_0_hsl(0_0%_100%_/_0.88)_inset] backdrop-blur lg:h-[100dvh] lg:border-b-0 lg:border-r",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shrink-0 border-b border-border/70 bg-white/35 p-5", className)}
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-3.5", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shrink-0 border-t border-border/70 bg-secondary/35 p-3.5", className)}
      {...props}
    />
  );
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
        "px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
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
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-600 transition-[background-color,color,transform,box-shadow] duration-200 ease-out hover:bg-accent/55 hover:text-zinc-950 active:translate-y-px data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-[0_12px_28px_hsl(160_31%_28%_/_0.2)]",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn("min-w-0", className)} {...props} />;
}
