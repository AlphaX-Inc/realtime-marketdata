import { UserPlus, UsersThree } from "@phosphor-icons/react";
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
import {
  Dialog,
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
import { ApiError, createUser, listUsers, updateUser } from "@/lib/api";

export const Route = createFileRoute("/dashboard/users")({
  component: UsersPage,
});

function UsersPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setName("");
      setEmail("");
      setPassword("");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateUser(id, { active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User access updated");
    },
  });
  const errorMessage =
    createMutation.error instanceof ApiError ? createMutation.error.message : null;
  const users = usersQuery.data?.users ?? [];

  return (
    <div className="grid gap-5">
      <PageHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <PageHeaderEyebrow>Dashboard</PageHeaderEyebrow>
            <PageHeaderTitle>Users</PageHeaderTitle>
            <PageHeaderDescription>
              Create dashboard operators and disable access when a person no longer needs the
              console.
            </PageHeaderDescription>
          </div>

          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              createMutation.reset();
            }}
          >
            <DialogTrigger asChild>
              <Button type="button">
                <UserPlus className="size-4" />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="size-4" />
                  Create user
                </DialogTitle>
                <DialogDescription>All users are admins in this first version.</DialogDescription>
              </DialogHeader>

              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createMutation.mutate({ name, email, password });
                }}
              >
                <FormField>
                  <Label htmlFor="user-name">Name</Label>
                  <Input
                    id="user-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="user-password">Password</Label>
                  <Input
                    id="user-password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </FormField>
                {errorMessage ? <FormMessage>{errorMessage}</FormMessage> : null}

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating" : "Create user"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Active users can sign in and manage service keys.</CardDescription>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <div className="grid gap-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : usersQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Unable to load users.</AlertDescription>
              </Alert>
            ) : users.length === 0 ? (
              <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border/80 bg-secondary/40 px-6 py-10 text-center">
                <div>
                  <div className="mx-auto grid size-12 place-items-center rounded-md bg-accent text-primary">
                    <UsersThree className="size-6" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-zinc-950">No users yet</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Add the first operator account when someone else needs access to the console.
                  </p>
                  <Button type="button" className="mt-5" onClick={() => setCreateOpen(true)}>
                    <UserPlus className="size-4" />
                    Add user
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "secondary" : "outline"}>
                          {user.active ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateMutation.mutate({ id: user.id, active: !user.active })
                          }
                          disabled={updateMutation.isPending}
                        >
                          {user.active ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
