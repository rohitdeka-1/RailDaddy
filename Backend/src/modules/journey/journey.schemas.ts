import { z } from "zod";

export const journeySearchSchema = z.object({
  source: z.string().min(1, "Source station is required"),
  destination: z.string().min(1, "Destination station is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export type JourneySearchInput = z.infer<typeof journeySearchSchema>;
