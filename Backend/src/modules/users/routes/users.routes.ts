import { json, Router } from "express";
import { requireAuth } from "../../../middleware/auth.js";
import { getMe, putMe } from "../controllers/users.controller.js";

export function createUsersRouter(secret: string) {
  const router = Router();
  const authenticate = requireAuth(secret);

  router.get("/me", authenticate, getMe);
  router.put("/me", authenticate, json({ limit: "1mb" }), putMe);

  return router;
}
