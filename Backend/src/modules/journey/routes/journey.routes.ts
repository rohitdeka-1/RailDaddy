import type { FastifyInstance } from "fastify";
import { JourneyController } from "../controllers/journey.controller.js";

export default async function journeyRoutes(app: FastifyInstance) {
  const controller = new JourneyController();

  app.get("/search", async function searchDirectJourneys(request, reply) {
    return controller.searchDirectJourneys(request, reply);
  });
}
