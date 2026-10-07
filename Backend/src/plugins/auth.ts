import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { envConfig } from "../config/envConfig.js";

import { UsersService } from "../modules/users/services/users.service.js";

interface AuthenticatedUser {
  cognitoSub: string;
}

// Tell TypeScript about the properties this plugin adds to Fastify.
declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

function sendUnauthorized(reply: FastifyReply): void {
  reply.header("WWW-Authenticate", "Bearer");
  reply.code(401);
  reply.send({ message: "Unauthorized" });
}

async function authPlugin(app: FastifyInstance) {

  const userPoolId = envConfig.COGNITO_USER_POOL_ID;
  const clientId = envConfig.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new Error("COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required");
  }
  // Create one verifier and reuse it for every request.
  const verifier = CognitoJwtVerifier.create({
    userPoolId: userPoolId,
    clientId: clientId,
    tokenUse: "access",
  });

  const usersService = new UsersService();

  // Each request starts without an authenticated user.
  app.decorateRequest("user", null);

  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authorization = request.headers.authorization;

    if (!authorization) {
      sendUnauthorized(reply);
      return;
    }

    // Expected header: "Bearer <access-token>".
    const parts = authorization.split(" ");
    const scheme = parts[0];
    const token = parts[1];

    if (parts.length !== 2 || !scheme || !token) {
      sendUnauthorized(reply);
      return;
    }

    if (scheme.toLowerCase() !== "bearer" || /\s/.test(token)) {
      sendUnauthorized(reply);
      return;
    }

    let cognitoSub: string;

    try {
      const claims = await verifier.verify(token);
      cognitoSub = claims.sub;
    } catch {
      sendUnauthorized(reply);
      return;
    }

    // Database failures must remain server errors, not authentication errors.
    const user = await usersService.ensureUserExists(cognitoSub);
    request.user = {
      cognitoSub: user.cognitoSub,
    };
  }

  app.decorate("authenticate", authenticate);
}

export default fastifyPlugin(authPlugin, { name: "auth", fastify: "5.x" });
