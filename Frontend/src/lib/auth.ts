import { queryOptions } from "@tanstack/react-query";

type Profile = {
  id: string;
  displayName: string | null;
};

export const profileQuery = queryOptions({
  queryKey: ["my-profile"],
  retry: false,
  async queryFn({ signal }): Promise<Profile | null> {
    const response = await fetch("/api/v1/users/me", { signal });
    if (response.status === 401 || response.status === 404) return null;
    if (!response.ok) throw new Error("Could not load your account.");
    return response.json();
  },
});

export async function submitAuth(
  action: "login" | "signup" | "logout",
  fields: Record<string, string> = {},
) {
  const response = await fetch(`/api/v1/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Could not reach the account service. Try again.");
  }
}
