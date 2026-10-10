import type { FastifyRequest, FastifyReply } from "fastify";
import { JourneyService } from "../services/journey.service.js";
import { journeySearchSchema } from "../journey.schemas.js";

export class JourneyController {
  private service: JourneyService;

  constructor() {
    this.service = new JourneyService();
  }

  async searchDirectJourneys(request: FastifyRequest, reply: FastifyReply) {
    const parsed = journeySearchSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid search parameters",
        issues: parsed.error.issues
      });
    }

    try {
      const results = await this.service.findDirectJourneys(parsed.data);
      return reply.status(200).send(results);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Failed to search journeys" });
    }
  }



}

