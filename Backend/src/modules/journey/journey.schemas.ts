import { z } from "zod";

const stationCode = z.string().trim().regex(/^[a-z0-9]{1,10}$/i, "Enter a station code").toUpperCase();

const journeyEndpoints = z.object({
  source: stationCode,
  destination: stationCode,
  date: z.iso.date(),
});

export const journeySearchSchema = journeyEndpoints.refine(({ source, destination }) => source !== destination, {
  path: ["destination"],
  message: "Choose a different arrival station.",
});

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const journeyPlanSchema = journeyEndpoints.extend({
  departAfter: clockTime.optional(),
  arriveBefore: clockTime.optional(),
  maxTransfers: z.literal([1, 2]).default(2),
  avoidTransfers: z.array(stationCode).max(10).default([]),
}).refine(({ source, destination }) => source !== destination, {
  path: ["destination"],
  message: "Choose a different arrival station.",
});

const stop = z.object({ code: z.string(), name: z.string(), date: z.iso.date() });
const itinerary = z.object({
  legs: z.array(z.object({
    train: z.object({ number: z.string(), name: z.string() }),
    from: stop.extend({ departure: clockTime }),
    to: stop.extend({ arrival: clockTime }),
  })).min(2),
  transfers: z.array(z.object({ waitMinutes: z.number().nonnegative() })),
  totalDurationMinutes: z.number().nonnegative(),
});
export const railPlanResponse = z.object({
  success: z.literal(true),
  data: z.object({ segments: z.array(z.object({
    plan: z.object({ itineraries: z.array(itinerary) }).nullish(),
  })).min(1) }),
});

export const journeyQuestionSchema = z.object({
  question: z.string().trim().min(1).max(600),
  trip: journeyEndpoints.optional(),
  history: z.array(z.object({
    question: z.string().trim().min(1).max(600),
    answer: z.string().min(1).max(1000),
  })).max(4).optional(),
});

export const stationSearchSchema = z.object({ q: z.string().trim().min(1).max(100) });

export type JourneySearchInput = z.infer<typeof journeySearchSchema>;
