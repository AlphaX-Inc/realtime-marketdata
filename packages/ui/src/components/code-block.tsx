import type * as React from "react";
import { cn } from "../lib/utils";

export function CodeBlock({ className, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-zinc-50 p-4 text-sm leading-6 text-zinc-800",
        className,
      )}
      {...props}
    />
  );
}

export function InlineCode({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn("rounded-md bg-secondary px-2 py-1 font-mono text-xs text-zinc-900", className)}
      {...props}
    />
  );
}
