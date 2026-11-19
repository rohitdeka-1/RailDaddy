import { Router } from "express";
import { searchDirectJourneys } from "../controllers/journey.controller.js";

const router = Router();
router.get("/search", searchDirectJourneys);

export default router;
