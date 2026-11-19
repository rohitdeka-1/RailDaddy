import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in | Rail Daddy" }] }),
  component: () => <AuthPage mode="login" />,
});
