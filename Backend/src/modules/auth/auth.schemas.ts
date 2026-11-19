import { z } from "zod";

const emailAddress = z.string().trim().toLowerCase().max(254).email("Enter a valid email address.");

export const loginForm = z.strictObject({
  email: emailAddress,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const signupForm = z.strictObject({
  email: emailAddress,
  displayName: z.string().trim().min(1, "Enter your name.").max(100),
  password: z.string().min(12, "Use at least 12 characters for your password.").max(128),
});

export type LoginDetails = z.infer<typeof loginForm>;
export type SignupDetails = z.infer<typeof signupForm>;
