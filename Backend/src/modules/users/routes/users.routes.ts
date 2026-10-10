import type { FastifyInstance } from "fastify";
import { UsersController } from "../controllers/users.controller.js";

export default async function usersRoutes(app: FastifyInstance) {
  const controller = new UsersController();

  app.addHook("onRequest", app.authenticate);

  app.get("/me", async function getProfile(request, reply) {
    return controller.getMe(request, reply);
  });

  app.put("/me", async function saveProfile(request, reply) {
    return controller.putMe(request, reply);
  });
}
