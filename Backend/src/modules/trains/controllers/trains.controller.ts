import type { Request, Response } from "express";
import { getSeatAvailability, RailCoreError } from "../../../integrations/railway/railCore.js";
import { getTrainDetails } from "../../../integrations/railway/railRadar.js";
import { seatAvailabilityInput } from "../trains.schemas.js";

export async function getTrainByNo(req: Request<{ trainNo: string }>, res: Response) {
  try {
    const train = await getTrainDetails(req.params.trainNo);
    return res.json(train);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function checkTrainSeats(req: Request<{ trainNo: string }>, res: Response) {
  res.set("Cache-Control", "no-store");
  const input = seatAvailabilityInput.safeParse({ ...req.query, train: req.params.trainNo });
  if (!input.success) {
    return res.status(400).json({ message: "Enter a valid train, route, date, class, and quota." });
  }

  try {
    return res.json({ data: await getSeatAvailability(input.data) });
  } catch (error) {
    if (error instanceof RailCoreError) {
      if (error.retryAfter) res.set("Retry-After", error.retryAfter);
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(502).json({ message: "RailCore could not verify seat availability. Try again shortly." });
  }
}
