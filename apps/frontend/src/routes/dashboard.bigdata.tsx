import { ChartBar } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@realtime-pricing/ui/components/alert";
import { Badge } from "@realtime-pricing/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@realtime-pricing/ui/components/card";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
} from "@realtime-pricing/ui/components/page-header";
import { Skeleton } from "@realtime-pricing/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@realtime-pricing/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type BigdataCall, getBigdataActivity } from "@/lib/api";

export const Route = createFileRoute("/dashboard/bigdata")({
  component: BigdataPage,
});

const numberFormat = new Intl.NumberFormat();

const errorLabels: Record<string, string> = {
  tool_error: "Tool returned error",
  rpc_error: "JSON-RPC error",
  unparseable: "Unreadable reply",
  aborted: "Client aborted",
  exception: "Proxy exception",
};

const missLabels: Record<string, string> = {
  new: "New args or caller",
  prev_failed: "Earlier call failed",
  expired: "Expired (>24h)",
  concurrent: "Concurrent duplicate",
  cache_lost: "Cache lost (Redis)",
};

function httpLabel(status: number) {
  if (status === 401 || status === 403) return "Auth rejected";
  if (status === 429) return "Rate limited";
  if (status >= 500) return "Bigdata server error";
  return `HTTP ${status}`;
}

// Errors explain themselves first; a successful MISS falls back to why the cache had nothing.
function callReason({ metadata: meta, missReason }: BigdataCall) {
  if (meta.error) {
    const reason = String(meta.errorReason ?? "");
    const label =
      reason === "http" ? httpLabel(Number(meta.status)) : (errorLabels[reason] ?? "Error");

    return { label, detail: meta.errorDetail ? String(meta.errorDetail) : "" };
  }

  return { label: missReason ? missLabels[missReason] : "-", detail: "" };
}

function BigdataPage() {
  const activityQuery = useQuery({
    queryKey: ["bigdata-activity"],
    queryFn: () => getBigdataActivity(100),
    refetchInterval: 10_000,
  });
  const tools = activityQuery.data?.tools ?? [];
  const calls = activityQuery.data?.calls ?? [];
  const total = tools.reduce(
    (sum, tool) => ({
      calls: sum.calls + tool.calls,
      hits: sum.hits + tool.hits,
      misses: sum.misses + tool.misses,
      bypassed: sum.bypassed + tool.bypassed,
      errors: sum.errors + tool.errors,
    }),
    { calls: 0, hits: 0, misses: 0, bypassed: 0, errors: 0 },
  );
  const cacheable = total.hits + total.misses;
  const stats = [
    { label: "Calls", value: numberFormat.format(total.calls) },
    {
      label: "Cache hit rate",
      value: cacheable > 0 ? `${Math.round((total.hits / cacheable) * 100)}%` : "-",
    },
    { label: "Upstream calls", value: numberFormat.format(total.misses + total.bypassed) },
    { label: "Errors", value: numberFormat.format(total.errors) },
  ];

  return (
    <div className="grid gap-5">
      <PageHeader>
        <PageHeaderEyebrow>Bigdata MCP proxy</PageHeaderEyebrow>
        <PageHeaderTitle>Bigdata</PageHeaderTitle>
        <PageHeaderDescription>
          Tool calls through /bigdata/mcp: cache hits, upstream calls that spend Bigdata credits,
          and errors.
        </PageHeaderDescription>
      </PageHeader>

      {activityQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : activityQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Unable to load Bigdata activity.</AlertDescription>
        </Alert>
      ) : calls.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border/80 bg-secondary/40 px-6 py-10 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-md bg-accent text-primary">
                  <ChartBar className="size-6" />
                </div>
                <p className="mt-4 text-sm font-semibold text-zinc-950">No Bigdata calls yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Tool calls will appear here once an MCP client uses /bigdata/mcp.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <CardDescription>{stat.label} (24h)</CardDescription>
                  <CardTitle className="text-2xl">{stat.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By tool</CardTitle>
              <CardDescription>
                Last 24 hours. Bypassed tools read or change account state and are never cached.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Hits</TableHead>
                    <TableHead className="text-right">Misses</TableHead>
                    <TableHead className="text-right">Bypassed</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Avg ms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((tool) => (
                    <TableRow key={tool.tool}>
                      <TableCell className="font-medium">{tool.tool}</TableCell>
                      <TableCell className="text-right">
                        {numberFormat.format(tool.calls)}
                      </TableCell>
                      <TableCell className="text-right">{numberFormat.format(tool.hits)}</TableCell>
                      <TableCell className="text-right">
                        {numberFormat.format(tool.misses)}
                      </TableCell>
                      <TableCell className="text-right">
                        {numberFormat.format(tool.bypassed)}
                      </TableCell>
                      <TableCell className="text-right">
                        {numberFormat.format(tool.errors)}
                      </TableCell>
                      <TableCell className="text-right">
                        {numberFormat.format(tool.avgDurationMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent calls</CardTitle>
              <CardDescription>
                Newest first, kept for 7 days. Reason says why a call failed, or why a MISS found
                nothing cached. Caller is a fingerprint of the Bearer token. This view refreshes
                every 10 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Tool</TableHead>
                    <TableHead>Cache</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">ms</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Args</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => {
                    const meta = call.metadata;
                    const args = String(meta.args ?? "");
                    const reason = callReason(call);

                    return (
                      <TableRow key={call.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">{String(meta.tool ?? "-")}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              meta.error
                                ? "destructive"
                                : meta.cache === "HIT"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {String(meta.cache ?? "-")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[260px]" title={reason.detail || undefined}>
                          <p className="whitespace-nowrap">{reason.label}</p>
                          {reason.detail ? (
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {reason.detail}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">{String(meta.status ?? "-")}</TableCell>
                        <TableCell className="text-right">
                          {String(meta.durationMs ?? "-")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {String(meta.caller ?? "-")}
                        </TableCell>
                        <TableCell
                          className="max-w-[320px] truncate font-mono text-xs"
                          title={args}
                        >
                          {args || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
