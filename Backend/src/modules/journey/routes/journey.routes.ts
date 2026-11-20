import { json, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { askJourneyQuestion, planConnectingJourney, searchDirectJourneys, searchJourneyStations } from "../controllers/journey.controller.js";

const router = Router();
router.get("/search", searchDirectJourneys);
router.get("/stations", searchJourneyStations);
router.post("/plan", json({ limit: "8kb" }), planConnectingJourney);
router.post("/ask", rateLimit({
  windowMs: 60_000,
  limit: 10,
  message: { message: "Too many questions. Try again in a minute." },
}), json({ limit: "48kb" }), askJourneyQuestion);

export default router;
