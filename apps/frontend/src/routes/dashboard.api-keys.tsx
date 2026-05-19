import { ClipboardText, Key, Trash } from "@phosphor-icons/react";
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
import { InlineCode } from "@realtime-pricing/ui/components/code-block";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@realtime-pricing/ui/components/dialog";
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
import { ApiError, createApiKey, deleteApiKey, listApiKeys } from "@/lib/api";

export const Route = createFileRoute("/dashboard/api-keys")({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const apiKeysQuery = useQuery({
    queryKey: ["api-keys"],
    queryFn: listApiKeys,
  });
  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Service key created");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Service key revoked");
    },
  });
  const errorMessage =
    createMutation.error instanceof ApiError ? createMutation.error.message : null;
  const apiKeys = apiKeysQuery.data?.apiKeys ?? [];

  return (
    <div className="grid gap-5">
      <PageHeader>
        <PageHeaderEyebrow>Service access</PageHeaderEyebrow>
        <PageHeaderTitle>Api Key</PageHeaderTitle>
        <PageHeaderDescription>
          Issue keys for internal services that connect to the realtime price WebSocket.
        </PageHeaderDescription>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-4" />
            Create service key
          </CardTitle>
          <CardDescription>
            Keys are stored encrypted and displayed here for operators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate({ name });
            }}
          >
            <FormField>
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="pricing-worker-us-east"
                required
              />
              {errorMessage ? <FormMessage>{errorMessage}</FormMessage> : null}
            </FormField>
            <Button type="submit" className="self-end" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating" : "Create key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service keys</CardTitle>
          <CardDescription>
            Use these values as `x-api-key` or `api_key` for `/ws/prices`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeysQuery.isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : apiKeysQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Unable to load API keys.</AlertDescription>
            </Alert>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service keys created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell>
                      <InlineCode className="block max-w-[360px] truncate">{apiKey.key}</InlineCode>
                    </TableCell>
                    <TableCell>
                      <Badge variant={apiKey.active ? "secondary" : "outline"}>
                        {apiKey.active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label="Copy API key"
                          onClick={() => {
                            void navigator.clipboard.writeText(apiKey.key);
                            toast.success("API key copied");
                          }}
                        >
                          <ClipboardText className="size-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label="Delete API key"
                              disabled={deleteMutation.isPending}
                            >
                              <Trash className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete service key</DialogTitle>
                              <DialogDescription>
                                This permanently revokes access for services using {apiKey.name}.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline">
                                  Cancel
                                </Button>
                              </DialogClose>
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={() => deleteMutation.mutate(apiKey.id)}
                                disabled={deleteMutation.isPending}
                              >
                                Delete key
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
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
