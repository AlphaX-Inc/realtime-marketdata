import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@realtime-pricing/ui/components/card";
import type { ReactNode } from "react";

export function AuthFormShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-[100dvh] bg-background text-zinc-950 lg:grid-cols-[minmax(0,1fr)_500px]">
      <section className="relative hidden overflow-hidden border-r border-border/70 px-12 py-10 lg:flex lg:flex-col lg:justify-center">
        <div className="absolute inset-x-12 top-36 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="absolute bottom-28 right-14 h-44 w-44 rounded-full border border-primary/15 bg-accent/40 blur-3xl" />
        <div>
          <div className="grid size-11 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground shadow-[0_14px_32px_hsl(160_31%_28%_/_0.22)]">
            AX
          </div>
          <p className="mt-12 text-sm font-semibold uppercase tracking-[0.14em] text-primary/75">
            AlphaX
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-[1.02] tracking-normal text-balance">
            Internal market data access, controlled from one console.
          </h1>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </section>
    </main>
  );
}
