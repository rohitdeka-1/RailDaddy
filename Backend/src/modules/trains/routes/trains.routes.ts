import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TrainsController } from "../controllers/trains.controller.js";

export default async function trainsRoutes(app: FastifyInstance) {
  const controller = new TrainsController();

  // Uncomment if this route should be authenticated
  // app.addHook("onRequest", app.authenticate);

  app.get("/:trainNo", async function getTrain(request: FastifyRequest<{ Params: { trainNo: string } }>, reply: FastifyReply) {
    return controller.getTrainByNo(request, reply);
  });
}
