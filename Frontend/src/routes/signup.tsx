import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create an account | Rail Daddy" }] }),
  component: () => <AuthPage mode="signup" />,
});
