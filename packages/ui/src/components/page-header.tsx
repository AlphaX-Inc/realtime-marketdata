import type * as React from "react";
import { cn } from "../lib/utils";

export function PageHeader({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <header className={cn("border-b border-border/70 pb-6 pt-1", className)} {...props} />;
}

export function PageHeaderEyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-primary/80",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "mt-2 max-w-4xl text-3xl font-semibold leading-[1.06] tracking-normal text-zinc-950 text-balance md:text-4xl",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-3 max-w-2xl text-sm leading-6 text-zinc-600 text-pretty", className)}
      {...props}
    />
  );
}
