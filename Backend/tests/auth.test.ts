import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { envConfig } from "../src/config/envConfig.js";
import authPlugin from "../src/plugins/auth.js";
import usersRoutes from "../src/modules/users/routes/users.routes.js";
import { UsersRepository } from "../src/modules/users/repositories/users.repository.js";
import type { User } from "../src/generated/prisma/index.js";

test("verified requests provision profiles; invalid tokens never reach the database", async (context) => {
  const originalPool = envConfig.COGNITO_USER_POOL_ID;
  const originalClient = envConfig.COGNITO_CLIENT_ID;
  envConfig.COGNITO_USER_POOL_ID = "us-east-1_test";
  envConfig.COGNITO_CLIENT_ID = "test-client";
  const records = new Map<string, User>();
  let databaseCalls = 0;
  let databaseFailed = false;
  context.mock.method(CognitoJwtVerifier, "create", () => ({
    async verify(token: string) {
      if (token !== "valid") throw new Error("Invalid token");
      return { sub: "user-a" };
    },
  }));
  context.mock.method(UsersRepository.prototype, "findOrCreate", async (sub: string) => {
    databaseCalls++;
    if (databaseFailed) throw new Error("Database unavailable");
    let user = records.get(sub);
    if (!user) {
      user = { id: "internal-id", cognitoSub: sub, displayName: null, email: null, preferences: null, createdAt: new Date(), updatedAt: new Date() };
      records.set(sub, user);
    }
    return user;
  });
  context.mock.method(UsersRepository.prototype, "findByCognitoSub", async (sub: string) => records.get(sub) ?? null);
  const app = Fastify();
  app.register(authPlugin);
  app.register(usersRoutes, { prefix: "/users" });
  try {
    for (const authorization of ["", "Bearer invalid", "Basic valid"]) {
      const response = await app.inject({ url: "/users/me", headers: { authorization } });
      assert.equal(response.statusCode, 401);
    }
    assert.equal(databaseCalls, 0);
    const headers = { authorization: "Bearer valid" };
    const first = await app.inject({ url: "/users/me", headers });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().cognitoSub, "user-a");
    assert.equal(first.json().displayName, null);
    const user = records.get("user-a")!;
    user.displayName = "Rohit";
    const next = await app.inject({ url: "/users/me", headers });
    assert.equal(next.json().displayName, "Rohit");
    assert.equal(records.size, 1);
    databaseFailed = true;
    assert.equal((await app.inject({ url: "/users/me", headers })).statusCode, 500);
  } finally {
    await app.close();
    envConfig.COGNITO_USER_POOL_ID = originalPool;
    envConfig.COGNITO_CLIENT_ID = originalClient;
  }
});
