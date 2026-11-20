import { Router } from "express";
import { checkTrainSeats, getTrainByNo } from "../controllers/trains.controller.js";

const router = Router();
router.get("/:trainNo/availability", checkTrainSeats);
router.get("/:trainNo", getTrainByNo);

export default router;
