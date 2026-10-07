import type { FastifyRequest, FastifyReply } from "fastify";
import { TrainsService } from "../services/trains.service.js";

export class TrainsController {
  private service: TrainsService;

  constructor() {
    this.service = new TrainsService();
  }

  async getTrainByNo(request: FastifyRequest<{ Params: { trainNo: string } }>, reply: FastifyReply) {
    const { trainNo } = request.params;
    try {
        const data = await this.service.getTrainByNo(trainNo);
        return reply.status(200).send(data);
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Internal Server Error" });
    }
  }
}
