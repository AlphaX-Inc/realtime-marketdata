import { ArrowsClockwise, GitBranch } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@realtime-pricing/ui/components/alert";
import { Badge } from "@realtime-pricing/ui/components/badge";
import { Button } from "@realtime-pricing/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@realtime-pricing/ui/components/card";
import { FormField, FormMessage } from "@realtime-pricing/ui/components/form-field";
import { Input } from "@realtime-pricing/ui/components/input";
import { Label } from "@realtime-pricing/ui/components/label";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ApiError,
  createStockSplit,
  listStockSplits,
  refreshStockSplit,
  type StockSplitAdjustment,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard/stock-splits")({
  component: StockSplitsPage,
});

function getSplitStatus(split: StockSplitAdjustment) {
  if (split.providerRefreshedAt) {
    return "Provider refreshed";
  }

  if (split.active) {
    return "Manual active";
  }

  return "Inactive";
}

function StockSplitsPage() {
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState("KLAC");
  const [adjustmentDate, setAdjustmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ratioFrom, setRatioFrom] = useState("1");
  const [ratioTo, setRatioTo] = useState("10");
  const [filterSymbols, setFilterSymbols] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const stockSplitsQuery = useQuery({
    queryKey: ["stock-splits", filterSymbols, filterFrom, filterTo],
    queryFn: () =>
      listStockSplits({
        symbols: filterSymbols,
        from: filterFrom,
        to: filterTo,
      }),
  });
  const createMutation = useMutation({
    mutationFn: createStockSplit,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["stock-splits"] });
      toast.success(`Stock split applied to ${data.adjustedRows} cached rows`);
    },
  });
  const refreshMutation = useMutation({
    mutationFn: refreshStockSplit,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["stock-splits"] });
      toast.success(
        `Provider history refreshed; ${data.adjustedRows} rows remain manually adjusted`,
      );
    },
  });
  const createError =
    createMutation.error instanceof ApiError ? createMutation.error.message : null;
  const refreshError =
    refreshMutation.error instanceof ApiError ? refreshMutation.error.message : null;
  const stockSplits = stockSplitsQuery.data?.stockSplits ?? [];

  return (
    <div className="grid gap-5">
      <PageHeader>
        <PageHeaderEyebrow>Historical adjustments</PageHeaderEyebrow>
        <PageHeaderTitle>Stock splits</PageHeaderTitle>
        <PageHeaderDescription>
          Apply manual stock split ratios to cached OHLC until upstream provider history is refreshed.
        </PageHeaderDescription>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Apply split
          </CardTitle>
          <CardDescription>
            The adjustment updates cached bars before the adjustment date. Existing OHLC endpoints
            return the adjusted values automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate({
                symbol,
                adjustmentDate,
                ratioFrom,
                ratioTo,
              });
            }}
          >
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] md:items-end">
              <FormField>
                <Label htmlFor="split-symbol">Symbol</Label>
                <Input
                  id="split-symbol"
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                  placeholder="KLAC or TSE:7203"
                  required
                />
              </FormField>
              <FormField>
                <Label htmlFor="split-date">Adjustment date</Label>
                <Input
                  id="split-date"
                  value={adjustmentDate}
                  onChange={(event) => setAdjustmentDate(event.target.value)}
                  type="date"
                  required
                />
              </FormField>
              <FormField>
                <Label htmlFor="ratio-from">From</Label>
                <Input
                  id="ratio-from"
                  value={ratioFrom}
                  onChange={(event) => setRatioFrom(event.target.value)}
                  inputMode="decimal"
                  required
                />
              </FormField>
              <FormField>
                <Label htmlFor="ratio-to">To</Label>
                <Input
                  id="ratio-to"
                  value={ratioTo}
                  onChange={(event) => setRatioTo(event.target.value)}
                  inputMode="decimal"
                  required
                />
              </FormField>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Applying" : "Apply"}
              </Button>
            </div>
            {createError ? <FormMessage>{createError}</FormMessage> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Split events</CardTitle>
          <CardDescription>
            Refresh from provider after Alpha Vantage or J-Quants history is trusted to include the
            split. This reloads provider history, then disables this manual adjustment to prevent
            double-adjusting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
            <FormField>
              <Label htmlFor="filter-symbols">Symbols</Label>
              <Input
                id="filter-symbols"
                value={filterSymbols}
                onChange={(event) => setFilterSymbols(event.target.value)}
                placeholder="Optional comma-separated symbols"
              />
            </FormField>
            <FormField>
              <Label htmlFor="filter-from">From</Label>
              <Input
                id="filter-from"
                value={filterFrom}
                onChange={(event) => setFilterFrom(event.target.value)}
                type="date"
              />
            </FormField>
            <FormField>
              <Label htmlFor="filter-to">To</Label>
              <Input
                id="filter-to"
                value={filterTo}
                onChange={(event) => setFilterTo(event.target.value)}
                type="date"
              />
            </FormField>
            <Button
              type="button"
              variant="outline"
              onClick={() => void stockSplitsQuery.refetch()}
            >
              Reload
            </Button>
          </div>

          {refreshError ? (
            <Alert variant="destructive">
              <AlertDescription>{refreshError}</AlertDescription>
            </Alert>
          ) : null}

          {stockSplitsQuery.isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : stockSplitsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Unable to load stock splits.</AlertDescription>
            </Alert>
          ) : stockSplits.length === 0 ? (
            <Alert>
              <AlertDescription>No stock split adjustments found.</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Ratio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockSplits.map((split) => (
                    <TableRow key={split.id}>
                      <TableCell className="font-medium">{split.symbol}</TableCell>
                      <TableCell>{split.adjustmentDate}</TableCell>
                      <TableCell>
                        {split.ratioFrom} -&gt; {split.ratioTo}
                      </TableCell>
                      <TableCell>
                        <Badge variant={split.active ? "default" : "outline"}>
                          {getSplitStatus(split)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {split.appliedAt ? new Date(split.appliedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(split.providerRefreshedAt) || refreshMutation.isPending}
                          onClick={() => refreshMutation.mutate(split.id)}
                        >
                          <ArrowsClockwise className="size-4" />
                          Refresh from provider
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
