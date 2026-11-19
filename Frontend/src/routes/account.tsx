import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AccountPage } from "@/components/auth-page";
import { Button } from "@/components/ui/button";
import { profileQuery, submitAuth } from "@/lib/auth";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Your account | Rail Daddy" }] }),
  component: Account,
});

function Account() {
  const profile = useQuery(profileQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await submitAuth("logout");
      await queryClient.cancelQueries({ queryKey: profileQuery.queryKey });
      queryClient.setQueryData(profileQuery.queryKey, null);
      await navigate({ to: "/login", replace: true });
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountPage title="Your account">
      {profile.isPending && <p role="status">Loading your account…</p>}
      {profile.isError && (
        <div className="space-y-3">
          <p role="alert">Could not load your account.</p>
          <Button onClick={() => profile.refetch()}>Try again</Button>
        </div>
      )}
      {profile.isSuccess && (
        profile.data ? (
          <>
            <p>{profile.data.displayName ? `Signed in as ${profile.data.displayName}.` : "You are signed in."}</p>
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <Button onClick={logout} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
          </>
        ) : (
          <>
            <p>Sign in to view your account.</p>
            <Button asChild><Link to="/login">Sign in</Link></Button>
          </>
        )
      )}
    </AccountPage>
  );
}
