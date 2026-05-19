import type * as React from "react";
import { cn } from "../lib/utils";

export function PageHeader({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <header className={cn("border-b border-border pb-5", className)} {...props} />;
}

export function PageHeaderEyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
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
        "mt-2 text-2xl font-semibold leading-tight tracking-normal text-zinc-950 md:text-3xl",
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
    <p className={cn("mt-2 max-w-3xl text-sm leading-6 text-zinc-600", className)} {...props} />
  );
}
