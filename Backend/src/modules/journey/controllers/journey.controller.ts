import type { Request, Response } from "express";
import { getTrainsBetweenStations, planRailJourney, RailRadarError, searchStations } from "../../../integrations/railway/railRadar.js";
import { envConfig } from "../../../config/envConfig.js";
import { journeyPlanSchema, journeyQuestionSchema, journeySearchSchema, railPlanResponse, stationSearchSchema } from "../journey.schemas.js";

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
    if (error instanceof RailRadarError && error.status === 404) {
      return res.status(404).json({ message: "One of those stations could not be found. Check the station codes." });
    }
    console.error(error);
    return res.status(502).json({ message: "Train schedules are temporarily unavailable. Try again shortly." });
  }

}

export async function searchJourneyStations(req: Request, res: Response) {

  const search = stationSearchSchema.safeParse(req.query);
  
  if (!search.success) {
    return res.status(400).json({ message: "Enter a station name or code." });
  }

  try {
    return res.json(await searchStations(search.data.q));
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: "Station search is temporarily unavailable." });
  }
  
}

export async function planConnectingJourney(req: Request, res: Response) {
  const search = journeyPlanSchema.safeParse(req.body);
  if (!search.success) {
    return res.status(400).json({ message: "Check the stations, travel date, and filters.", issues: search.error.issues });
  }

  const { source, destination, date, departAfter, arriveBefore, maxTransfers, avoidTransfers } = search.data;
  try {
    const payload = await planRailJourney({
      stops: [source, destination],
      date,
      minTransfers: 1,
      maxTransfers,
      maxItineraries: 30,
      departAfter,
      arriveBefore,
    });
    const parsed = railPlanResponse.parse(payload);
    const blocked = new Set(avoidTransfers);
    const itineraries = (parsed.data.segments[0]?.plan?.itineraries ?? []).filter(({ legs }) =>
      legs.slice(0, -1).every(({ to }) => !blocked.has(to.code)) &&
      legs.slice(1).every(({ from }) => !blocked.has(from.code)));
    return res.json({ success: true, data: { itineraries } });
  } catch (error) {
    if (error instanceof RailRadarError && error.status === 404) {
      return res.status(404).json({ message: "A station in this trip could not be found." });
    }
    console.error(error);
    return res.status(502).json({ message: "Connecting routes are temporarily unavailable. Try again shortly." });
  }
}

export async function askJourneyQuestion(req: Request, res: Response) {
  const input = journeyQuestionSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Enter a question of up to 600 characters." });
  const { GEMINI_API_KEY, GEMINI_CHAT_MODEL } = envConfig;
  if (!GEMINI_API_KEY || !GEMINI_CHAT_MODEL) {
    return res.status(503).json({ message: "AI chat is unavailable. You can still use the quick answers and connection planner." });
  }

  const { history = [], ...question } = input.data;
  const contents = history.flatMap((turn) => [
    { role: "user", parts: [{ text: turn.question }] },
    { role: "model", parts: [{ text: turn.answer }] },
  ]);
  contents.push({ role: "user", parts: [{ text: JSON.stringify(question) }] });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_CHAT_MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are Rail Daddy's Indian train travel assistant. Give short practical answers. The optional trip is context only. You cannot look up schedules, fares, seat inventory, or bookings. Never invent them. Direct users to the connection planner for real schedules and to the official booking channel for fares and seats. Explain that transfers may require separate tickets. Answer rail travel questions only." }] },
        contents,
        generationConfig: { maxOutputTokens: 512 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}`);
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const answer = payload.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim();
    if (!answer) throw new Error("Gemini returned no answer");
    return res.json({ answer });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: "AI chat could not answer. Try again shortly." });
  }
}
