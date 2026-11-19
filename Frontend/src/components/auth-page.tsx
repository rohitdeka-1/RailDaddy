import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { profileQuery, submitAuth } from "@/lib/auth";

export function AccountPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-5 inline-block text-sm font-medium text-muted-foreground hover:underline">
          ← Back to Rail Daddy
        </Link>
        <section className="space-y-5 rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold">{title}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const title = signup ? "Create an account" : "Sign in";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const fields = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      ...(signup && { displayName: String(form.get("displayName") ?? "") }),
    };

    try {
      await submitAuth(mode, fields);
      queryClient.removeQueries({ queryKey: profileQuery.queryKey });
      await navigate({ to: "/account", replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountPage title={title}>
      <form method="post" onSubmit={handleSubmit} className="space-y-4">
        {signup && (
          <label className="block space-y-1 text-sm font-medium">
            <span>Display name</span>
            <Input name="displayName" autoComplete="name" maxLength={100} required />
          </label>
        )}
        <label className="block space-y-1 text-sm font-medium">
          <span>Email address</span>
          <Input name="email" type="email" autoComplete="username" maxLength={254} required />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>Password</span>
          <Input
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 12 : undefined}
            maxLength={128}
            aria-describedby={signup ? "password-hint" : undefined}
            required
          />
        </label>
        {signup && <p id="password-hint" className="text-sm text-muted-foreground">Use at least 12 characters.</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : title}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {signup ? "Already have an account? " : "New to Rail Daddy? "}
        <Link className="font-medium text-foreground underline" to={signup ? "/login" : "/signup"}>
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </AccountPage>
  );
}
