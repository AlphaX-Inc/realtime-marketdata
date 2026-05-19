import { Broadcast } from "@phosphor-icons/react";
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
import { listGatewayLogs } from "@/lib/api";

export const Route = createFileRoute("/dashboard/logs")({
  component: LogsPage,
});

function LogsPage() {
  const logsQuery = useQuery({
    queryKey: ["gateway-logs"],
    queryFn: () => listGatewayLogs(100),
    refetchInterval: 10_000,
  });
  const logs = logsQuery.data?.logs ?? [];

  return (
    <div className="grid gap-5">
      <PageHeader>
        <PageHeaderEyebrow>Gateway activity</PageHeaderEyebrow>
        <PageHeaderTitle>Logs</PageHeaderTitle>
        <PageHeaderDescription>
          Recent WebSocket gateway connection, subscription, and upstream lifecycle events.
        </PageHeaderDescription>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Newest events first. This view refreshes every 10 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : logsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Unable to load gateway logs.</AlertDescription>
            </Alert>
          ) : logs.length === 0 ? (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border/80 bg-secondary/40 px-6 py-10 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-md bg-accent text-primary">
                  <Broadcast className="size-6" />
                </div>
                <p className="mt-4 text-sm font-semibold text-zinc-950">No gateway activity</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Connection, subscription, and upstream events will appear here as services use the
                  WebSocket.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Service Key</TableHead>
                  <TableHead>Symbols</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.source === "upstream" ? "secondary" : "outline"}>
                        {log.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.eventType}</TableCell>
                    <TableCell>{log.serviceApiKeyName ?? "-"}</TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {log.symbols.length > 0 ? log.symbols.join(", ") : "-"}
                    </TableCell>
                    <TableCell>{log.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
