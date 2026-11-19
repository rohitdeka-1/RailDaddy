import type { Request, Response } from "express";
import { getTrainsBetweenStations } from "../../../integrations/railway/railRadar.js";
import { journeySearchSchema } from "../journey.schemas.js";

export async function searchDirectJourneys(req: Request, res: Response) {
  const search = journeySearchSchema.safeParse(req.query);
  if (!search.success) {
    return res.status(400).json({ message: "Invalid search parameters", issues: search.error.issues });
  }

  const { source, destination, date } = search.data;
  try {
    const journeys = await getTrainsBetweenStations(source, destination, date);
    return res.json(journeys);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to search journeys" });
  }
}
