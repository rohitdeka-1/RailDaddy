import type { FastifyReply, FastifyRequest } from "fastify";
import { UsersService } from "../services/users.service.js";
import { updateProfileSchema } from "../users.schemas.js";

export class UsersController {
  private service: UsersService;

  constructor() {
    this.service = new UsersService();
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {

    if (!request.user) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const user = await this.service.getProfile(request.user.cognitoSub);

    if (!user) {
      return reply.code(404).send({ message: "Profile not found. Create it with PUT /api/v1/users/me." });
    }

    return reply.send(user);
  }

  async putMe(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const parsed = updateProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid profile", issues: parsed.error.issues });
    }

    const user = await this.service.saveProfile(request.user.cognitoSub, parsed.data);
    return reply.send(user);
  }
}


