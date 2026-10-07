import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).nullable(),
  email: z.string().email().nullable().optional(),
  preferences: z.record(z.string(), z.any()).nullable().optional(),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
