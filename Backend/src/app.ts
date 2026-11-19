import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { envConfig } from "./config/envConfig.js";
import { prisma } from "./config/prisma.js";
import { createAuthRouter } from "./modules/auth/routes/auth.routes.js";
import { createUsersRouter } from "./modules/users/routes/users.routes.js";
import trainsRouter from "./modules/trains/routes/trains.routes.js";
import journeyRouter from "./modules/journey/routes/journey.routes.js";

declare global {
  namespace Express {
    interface Locals {
      database: typeof prisma;
      jwtSecret: string;
    }
  }
}

export function buildApp(database = prisma) {
  const secret = envConfig.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET must be at least 32 bytes");
  }

  const app = express();
  app.locals.database = database;
  app.locals.jwtSecret = secret;
  app.disable("x-powered-by");
  app.use(cookieParser());

  // Each router handles the paths under its own API prefix.
  app.use("/api/v1/auth", createAuthRouter());
  app.use("/api/v1/users", createUsersRouter(secret));
  app.use("/api/v1/trains", trainsRouter);
  app.use("/api/v1/journey", journeyRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "RailDaddy-Backend" });
  });

  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found." });
  });

  // Express sends errors from async route handlers here.
  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error.status === 400) {
      res.status(400).json({ message: "Invalid request." });
      return;
    }
    if (error.status === 413) {
      res.status(413).json({ message: "Request body is too large." });
      return;
    }
    if (error.status === 415) {
      res.status(415).json({ message: "Unsupported request format." });
      return;
    }

    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  };
  app.use(handleError);

  return app;
}
