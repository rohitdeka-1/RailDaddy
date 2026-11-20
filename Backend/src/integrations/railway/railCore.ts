import { z } from "zod";
import { envConfig } from "../../config/envConfig.js";
import type { SeatAvailabilityInput } from "../../modules/trains/trains.schemas.js";

const availabilityStatus = z.enum(["AVAILABLE", "RAC", "WAITLIST", "REGRET", "NOT_AVAILABLE", "TRAIN_CANCELLED", "TRAIN_DEPARTED", "UNKNOWN"]);

const seatResponse = z.object({
  success: z.literal(true),
  data: z.object({
    train_number: z.string(),
    from_station_code: z.string(),
    to_station_code: z.string(),
    journey_date: z.iso.date(),
    quota: z.string(),
    classes: z.array(z.object({
      class_code: z.string(),
      status: z.string(),
      availability_text: z.string().nullish(),
      available_count: z.number().int().nonnegative().nullish(),
      total_fare: z.number().nonnegative().nullish(),
      last_updated_at: z.iso.datetime({ offset: true }).nullish(),
    })),
  }),
});

const errorResponse = z.object({ error: z.object({ message: z.string().max(500) }) });

export class RailCoreError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfter?: string) {
    super(message);
  }
}

export async function getSeatAvailability(input: SeatAvailabilityInput) {
  const key = envConfig.RAIL_CORE_API?.trim();
  if (!key) throw new RailCoreError(503, "Seat availability is not configured.");

  const { train, ...query } = input;
  const params = new URLSearchParams({ train_number: train, ...query });
  const response = await fetch(`https://ir.railcore.tech/v1/availability/seats?${params}`, {
    headers: { "X-RailCore-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 422) {
      const details = errorResponse.safeParse(payload);
      throw new RailCoreError(422, details.data?.error.message ?? "RailCore could not check this date, class, or quota.");
    }
    if (response.status === 402 || response.status === 429) {
      throw new RailCoreError(response.status, "RailCore's seat enquiry quota has been reached.", response.headers.get("Retry-After") ?? undefined);
    }
    if (response.status === 404) throw new RailCoreError(404, "RailCore could not find this train or segment.");
    throw new RailCoreError(503, "RailCore seat availability is temporarily unavailable.", response.headers.get("Retry-After") ?? undefined);
  }

  const { data } = seatResponse.parse(payload);
  const seat = data.classes.find((entry) => entry.class_code === input.class);
  if (!seat || data.train_number !== train || data.journey_date !== input.date ||
      data.from_station_code !== input.from || data.to_station_code !== input.to || data.quota !== input.quota) {
    throw new Error("RailCore returned a different seat enquiry.");
  }

  return {
    status: availabilityStatus.safeParse(seat.status).data ?? "UNKNOWN",
    description: seat.availability_text ?? null,
    availableCount: seat.available_count ?? null,
    totalFare: seat.total_fare ?? null,
    observedAt: seat.last_updated_at ?? null,
  };
}
