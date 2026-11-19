import type { Request, Response } from "express";
import { getTrainDetails } from "../../../integrations/railway/railRadar.js";

export async function getTrainByNo(req: Request<{ trainNo: string }>, res: Response) {
  try {
    const train = await getTrainDetails(req.params.trainNo);
    return res.json(train);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
