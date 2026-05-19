import { Button } from "@realtime-pricing/ui/components/button";
import {
  FormDescription,
  FormField,
  FormMessage,
} from "@realtime-pricing/ui/components/form-field";
import { Input } from "@realtime-pricing/ui/components/input";
import { Label } from "@realtime-pricing/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFormShell } from "@/components/auth-form-shell";
import { ApiError, getBootstrapStatus, register } from "@/lib/api";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bootstrapQuery = useQuery({
    queryKey: ["auth", "bootstrap"],
    queryFn: getBootstrapStatus,
    retry: false,
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: async (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      await navigate({ to: "/dashboard" });
    },
  });
  const errorMessage = mutation.error instanceof ApiError ? mutation.error.message : null;

  if (bootstrapQuery.data && !bootstrapQuery.data.registrationOpen) {
    return (
      <AuthFormShell
        title="Registration closed"
        description="The first admin account already exists."
      >
        <Button asChild className="w-full">
          <Link to="/login">Go to login</Link>
        </Button>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell title="Create admin" description="Bootstrap the first dashboard account.">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({ name, email, password });
        }}
      >
        <FormField>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </FormField>
        <FormField>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </FormField>
        <FormField>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <FormDescription>Use at least 8 characters.</FormDescription>
        </FormField>
        {errorMessage ? <FormMessage>{errorMessage}</FormMessage> : null}
        <Button type="submit" disabled={mutation.isPending || bootstrapQuery.isLoading}>
          {mutation.isPending ? "Creating account" : "Create admin account"}
        </Button>
      </form>
    </AuthFormShell>
  );
}
