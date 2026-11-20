import { z } from "zod";

const stationCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/);

export const seatAvailabilityInput = z.object({
  train: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,6}$/),
  from: stationCode,
  to: stationCode,
  date: z.iso.date(),
  class: z.enum(["1A", "2A", "3A", "3E", "EC", "CC", "FC", "SL", "2S"]),
  quota: z.enum(["GN", "TQ", "SS", "LD"]).default("GN"),
}).refine(({ from, to }) => from !== to, { path: ["to"], message: "Choose different stations." });

export type SeatAvailabilityInput = z.infer<typeof seatAvailabilityInput>;
