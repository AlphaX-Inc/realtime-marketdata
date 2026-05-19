import { Button } from "@realtime-pricing/ui/components/button";
import { FormField, FormMessage } from "@realtime-pricing/ui/components/form-field";
import { Input } from "@realtime-pricing/ui/components/input";
import { Label } from "@realtime-pricing/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFormShell } from "@/components/auth-form-shell";
import { ApiError, login } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      await navigate({ to: "/dashboard" });
    },
  });
  const errorMessage = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <AuthFormShell
      title="Sign in"
      description="Use your dashboard account to manage service access."
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({ email, password });
        }}
      >
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </FormField>
        {errorMessage ? <FormMessage>{errorMessage}</FormMessage> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Signing in" : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground">
          First setup?{" "}
          <Link to="/register" className="font-medium text-zinc-950 underline underline-offset-4">
            Register the admin account
          </Link>
        </p>
      </form>
    </AuthFormShell>
  );
}
