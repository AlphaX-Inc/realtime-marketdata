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
    <main className="grid min-h-[100dvh] bg-background text-zinc-950 lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="hidden border-r border-border px-10 py-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="grid size-10 place-items-center rounded-lg bg-zinc-950 text-sm font-semibold text-white">
            RP
          </div>
          <p className="mt-10 text-sm font-medium text-zinc-500">Realtime Pricing</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-normal">
            Internal market data access, controlled from one console.
          </h1>
        </div>
        <div className="grid max-w-xl gap-5 text-sm text-zinc-600">
          <div>
            <p className="font-medium text-zinc-950">Single upstream Twelve Data stream.</p>
            <p className="mt-2 leading-6">
              Downstream services receive normalized WebSocket prices without opening their own
              upstream connections.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-5">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-zinc-500">Access</p>
              <p className="mt-2 text-sm font-medium text-zinc-950">Service API keys</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-zinc-500">Ops</p>
              <p className="mt-2 text-sm font-medium text-zinc-950">Gateway logs</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md border-zinc-200 bg-white">
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
