import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).nullable(),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
