import { json, Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { signup, login, logout } from "../controllers/auth.controller.js";

function passwordAttemptLimit() {
  return rateLimit({
    limit: 10,
    windowMs: 60_000,
    message: { message: "Too many attempts. Try again in a minute." },
  });
}

const requireJson: RequestHandler = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  // A cross-origin form cannot send JSON, so it cannot change the session.
  const contentType = req.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    res.status(415).json({ message: "Send an application/json request." });
    return;
  }
  next();
};

const readJsonForm = [requireJson, json({ limit: "1mb" })];

// app.ts mounts these three routes under /api/v1/auth.
export function createAuthRouter() {
  const router = Router();

  router.post("/signup", readJsonForm, passwordAttemptLimit(), signup);
  router.post("/login", readJsonForm, passwordAttemptLimit(), login);
  router.post("/logout", readJsonForm, logout);
  return router;
}
