import { Router } from "express";
import { getTrainByNo } from "../controllers/trains.controller.js";

const router = Router();
router.get("/:trainNo", getTrainByNo);

export default router;
